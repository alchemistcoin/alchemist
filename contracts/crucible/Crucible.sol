// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;
pragma abicoder v2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/EnumerableSet.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import {EIP712} from "./EIP712.sol";
import {ERC1271} from "./ERC1271.sol";
import {OwnableERC721} from "./OwnableERC721.sol";
import {IRageQuit} from "../aludel/Aludel.sol";

interface IUniversalVault {
    /* user events */

    event Locked(address delegate, address token, uint256 amount);
    event Unlocked(address delegate, address token, uint256 amount);
    event RageQuit(address delegate, address token, bool notified, string reason);

    /* data types */

    struct LockData {
        address delegate;
        address token;
        uint256 balance;
    }

    /* initialize function */

    function initialize() external;

    /* user functions */

    function lock(
        address token,
        uint256 amount,
        bytes calldata permission
    ) external;

    function unlock(
        address token,
        uint256 amount,
        bytes calldata permission
    ) external;

    function rageQuit(address delegate, address token)
        external
        returns (bool notified, string memory error);

    function transferERC20(
        address token,
        address to,
        uint256 amount
    ) external;

    function transferETH(address to, uint256 amount) external payable;

    /* pure functions */

    function calculateLockID(address delegate, address token)
        external
        pure
        returns (bytes32 lockID);

    /* getter functions */

    function getPermissionHash(
        bytes32 eip712TypeHash,
        address delegate,
        address token,
        uint256 amount,
        uint256 nonce
    ) external view returns (bytes32 permissionHash);

    function getNonce() external view returns (uint256 nonce);

    function owner() external view returns (address ownerAddress);

    function getLockSetCount() external view returns (uint256 count);

    function getLockAt(uint256 index) external view returns (LockData memory lockData);

    function getBalanceDelegated(address token, address delegate)
        external
        view
        returns (uint256 balance);

    function getBalanceLocked(address token) external view returns (uint256 balance);

    function checkBalances() external view returns (bool validity);
}

/// @title Crucible
/// @notice Vault for isolated storage of staking tokens
/// @dev Warning: not compatible with rebasing tokens
contract Crucible is
    IUniversalVault,
    EIP712("UniversalVault", "1.0.0"),
    ERC1271,
    OwnableERC721,
    Initializable
{
    using SafeMath for uint256;
    using Address for address;
    using Address for address payable;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /* constant */

    // Hardcoding a gas limit for rageQuit() is required to prevent gas DOS attacks
    // the gas requirement cannot be determined at runtime by querying the delegate
    // as it could potentially be manipulated by a malicious delegate who could force
    // the calls to revert.
    // The gas limit could alternatively be set upon vault initialization or creation
    // of a lock, but the gas consumption trade-offs are not favorable.
    // Ultimately, to avoid a need for fixed gas limits, the EVM would need to provide
    // an error code that allows for reliably catching out-of-gas errors on remote calls.
    uint256 public constant RAGEQUIT_GAS = 500000;
    bytes32 public constant LOCK_TYPEHASH =
        keccak256("Lock(address delegate,address token,uint256 amount,uint256 nonce)");
    bytes32 public constant UNLOCK_TYPEHASH =
        keccak256("Unlock(address delegate,address token,uint256 amount,uint256 nonce)");

    /* storage */

    uint256 private _nonce;
    mapping(bytes32 => LockData) private _locks;
    EnumerableSet.Bytes32Set private _lockSet;

    /* initialization function */

    function initializeLock() external initializer {}

    function initialize() external override initializer {
        OwnableERC721._setNFT(msg.sender);
    }

    /* ether receive */

    receive() external payable {}

    /* internal overrides */

    function _getOwner() internal view override(ERC1271) returns (address ownerAddress) {
        return OwnableERC721.owner();
    }

    /* pure functions */

    function calculateLockID(address delegate, address token)
        public
        pure
        override
        returns (bytes32 lockID)
    {
        return keccak256(abi.encodePacked(delegate, token));
    }

    /* getter functions */

    function getPermissionHash(
        bytes32 eip712TypeHash,
        address delegate,
        address token,
        uint256 amount,
        uint256 nonce
    ) public view override returns (bytes32 permissionHash) {
        return
            EIP712._hashTypedDataV4(
                keccak256(abi.encode(eip712TypeHash, delegate, token, amount, nonce))
            );
    }

    function getNonce() external view override returns (uint256 nonce) {
        return _nonce;
    }

    function owner()
        public
        view
        override(IUniversalVault, OwnableERC721)
        returns (address ownerAddress)
    {
        return OwnableERC721.owner();
    }

    function getLockSetCount() external view override returns (uint256 count) {
        return _lockSet.length();
    }

    function getLockAt(uint256 index) external view override returns (LockData memory lockData) {
        return _locks[_lockSet.at(index)];
    }

    function getBalanceDelegated(address token, address delegate)
        external
        view
        override
        returns (uint256 balance)
    {
        return _locks[calculateLockID(delegate, token)].balance;
    }

    function getBalanceLocked(address token) public view override returns (uint256 balance) {
        uint256 count = _lockSet.length();
        for (uint256 index; index < count; index++) {
            LockData storage _lockData = _locks[_lockSet.at(index)];
            if (_lockData.token == token && _lockData.balance > balance)
                balance = _lockData.balance;
        }
        return balance;
    }

    function checkBalances() external view override returns (bool validity) {
        // iterate over all token locks and validate sufficient balance
        uint256 count = _lockSet.length();
        for (uint256 index; index < count; index++) {
            // fetch storage lock reference
            LockData storage _lockData = _locks[_lockSet.at(index)];
            // if insufficient balance and no∏t shutdown, return false
            if (IERC20(_lockData.token).balanceOf(address(this)) < _lockData.balance) return false;
        }
        // if sufficient balance or shutdown, return true
        return true;
    }

    /* user functions */

    /// @notice Lock ERC20 tokens in the vault
    /// access control: called by delegate with signed permission from owner
    /// state machine: anytime
    /// state scope:
    /// - insert or update _locks
    /// - increase _nonce
    /// token transfer: none
    /// @param token Address of token being locked
    /// @param amount Amount of tokens being locked
    /// @param permission Permission signature payload
    function lock(
        address token,
        uint256 amount,
        bytes calldata permission
    )
        external
        override
        onlyValidSignature(
            getPermissionHash(LOCK_TYPEHASH, msg.sender, token, amount, _nonce),
            permission
        )
    {
        // get lock id
        bytes32 lockID = calculateLockID(msg.sender, token);

        // add lock to storage
        if (_lockSet.contains(lockID)) {
            // if lock already exists, increase amount
            _locks[lockID].balance = _locks[lockID].balance.add(amount);
        } else {
            // if does not exist, create new lock
            // add lock to set
            assert(_lockSet.add(lockID));
            // add lock data to storage
            _locks[lockID] = LockData(msg.sender, token, amount);
        }

        // validate sufficient balance
        require(
            IERC20(token).balanceOf(address(this)) >= _locks[lockID].balance,
            "UniversalVault: insufficient balance"
        );

        // increase nonce
        _nonce += 1;

        // emit event
        emit Locked(msg.sender, token, amount);
    }

    /// @notice Unlock ERC20 tokens in the vault
    /// access control: called by delegate with signed permission from owner
    /// state machine: after valid lock from delegate
    /// state scope:
    /// - remove or update _locks
    /// - increase _nonce
    /// token transfer: none
    /// @param token Address of token being unlocked
    /// @param amount Amount of tokens being unlocked
    /// @param permission Permission signature payload
    function unlock(
        address token,
        uint256 amount,
        bytes calldata permission
    )
        external
        override
        onlyValidSignature(
            getPermissionHash(UNLOCK_TYPEHASH, msg.sender, token, amount, _nonce),
            permission
        )
    {
        // get lock id
        bytes32 lockID = calculateLockID(msg.sender, token);

        // validate existing lock
        require(_lockSet.contains(lockID), "UniversalVault: missing lock");

        // update lock data
        if (_locks[lockID].balance > amount) {
            // substract amount from lock balance
            _locks[lockID].balance = _locks[lockID].balance.sub(amount);
        } else {
            // delete lock data
            delete _locks[lockID];
            assert(_lockSet.remove(lockID));
        }

        // increase nonce
        _nonce += 1;

        // emit event
        emit Unlocked(msg.sender, token, amount);
    }

    /// @notice Forcibly cancel delegate lock
    /// @dev This function will attempt to notify the delegate of the rage quit using
    ///      a fixed amount of gas.
    /// access control: only owner
    /// state machine: after valid lock from delegate
    /// state scope:
    /// - remove item from _locks
    /// token transfer: none
    /// @param delegate Address of delegate
    /// @param token Address of token being unlocked
    function rageQuit(address delegate, address token)
        external
        override
        onlyOwner
        returns (bool notified, string memory error)
    {
        // get lock id
        bytes32 lockID = calculateLockID(delegate, token);

        // validate existing lock
        require(_lockSet.contains(lockID), "UniversalVault: missing lock");

        // attempt to notify delegate
        if (delegate.isContract()) {
            // check for sufficient gas
            require(gasleft() >= RAGEQUIT_GAS, "UniversalVault: insufficient gas");

            // attempt rageQuit notification
            try IRageQuit(delegate).rageQuit{gas: RAGEQUIT_GAS}() {
                notified = true;
            } catch Error(string memory res) {
                notified = false;
                error = res;
            } catch (bytes memory) {
                notified = false;
            }
        }

        // update lock storage
        assert(_lockSet.remove(lockID));
        delete _locks[lockID];

        // emit event
        emit RageQuit(delegate, token, notified, error);
    }

    /// @notice Transfer ERC20 tokens out of vault
    /// access control: only owner
    /// state machine: when balance >= max(lock) + amount
    /// state scope: none
    /// token transfer: transfer any token
    /// @param token Address of token being transferred
    /// @param to Address of the recipient
    /// @param amount Amount of tokens to transfer
    function transferERC20(
        address token,
        address to,
        uint256 amount
    ) external override onlyOwner {
        // check for sufficient balance
        require(
            IERC20(token).balanceOf(address(this)) >= getBalanceLocked(token).add(amount),
            "UniversalVault: insufficient balance"
        );
        // perform transfer
        TransferHelper.safeTransfer(token, to, amount);
    }

    /// @notice Transfer ERC20 tokens out of vault
    /// access control: only owner
    /// state machine: when balance >= amount
    /// state scope: none
    /// token transfer: transfer any token
    /// @param to Address of the recipient
    /// @param amount Amount of ETH to transfer
    function transferETH(address to, uint256 amount) external payable override onlyOwner {
        // perform transfer
        TransferHelper.safeTransferETH(to, amount);
    }
}
