// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;
// pragma experimental SMTChecker;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import {ERC20Snapshot} from "@openzeppelin/contracts/token/ERC20/ERC20Snapshot.sol";
import {ERC20Permit} from "@openzeppelin/contracts/drafts/ERC20Permit.sol";
import {TimelockConfig} from "./TimelockConfig.sol";

interface IAlchemist {
    /* event */

    event Advanced(uint256 epoch, uint256 supplyMinted);

    /* user functions */

    function advance() external;

    /* view functions */

    function getAdmin() external view returns (address admin);

    function getRecipient() external view returns (address recipient);

    function getTimelock() external view returns (uint256 timelock);

    function getInflationBps() external view returns (uint256 inflationBps);

    function getEpochDuration() external view returns (uint256 epochDuration);
}

// ⚗️ Alchemist ⚗️
contract Alchemist is
    IAlchemist,
    ERC20("Alchemist", unicode"⚗️"),
    ERC20Burnable,
    ERC20Snapshot,
    ERC20Permit("Alchemist"),
    TimelockConfig
{
    /* constants */

    bytes32 public constant RECIPIENT_CONFIG_ID = keccak256("Recipient");
    bytes32 public constant INFLATION_BPS_CONFIG_ID = keccak256("InflationBPS");
    bytes32 public constant EPOCH_DURATION_CONFIG_ID = keccak256("EpochDuration");

    /* storage */

    uint256 public _epoch;
    uint256 public _previousEpochTimestamp;

    /* constructor function */

    constructor(
        address admin,
        address recipient,
        uint256 inflationBps,
        uint256 epochDuration,
        uint256 timelock,
        uint256 supply,
        uint256 epochStart
    ) TimelockConfig(admin, timelock) {
        // set config
        TimelockConfig._setRawConfig(RECIPIENT_CONFIG_ID, uint256(recipient));
        TimelockConfig._setRawConfig(INFLATION_BPS_CONFIG_ID, inflationBps);
        TimelockConfig._setRawConfig(EPOCH_DURATION_CONFIG_ID, epochDuration);

        // set epoch timestamp
        _previousEpochTimestamp = epochStart;

        // mint initial supply
        ERC20._mint(recipient, supply);
    }

    /* user functions */

    function advance() external override {
        // require new epoch
        require(
            block.timestamp >= _previousEpochTimestamp + getEpochDuration(),
            "not ready to advance"
        );
        // set epoch
        _epoch++;
        _previousEpochTimestamp = block.timestamp;
        // create snapshot
        ERC20Snapshot._snapshot();
        // calculate inflation amount
        uint256 supplyMinted = (ERC20.totalSupply() * getInflationBps()) / 10000;
        // mint to tokenManager
        ERC20._mint(getRecipient(), supplyMinted);
        // emit event
        emit Advanced(_epoch, supplyMinted);
    }

    /* hook functions */

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Snapshot) {
        ERC20Snapshot._beforeTokenTransfer(from, to, amount);
    }

    /* view functions */

    function getAdmin() public view override returns (address admin) {
        return address(TimelockConfig.getConfig(TimelockConfig.ADMIN_CONFIG_ID).value);
    }

    function getRecipient() public view override returns (address recipient) {
        return address(TimelockConfig.getConfig(RECIPIENT_CONFIG_ID).value);
    }

    function getTimelock() public view override returns (uint256 timelock) {
        return TimelockConfig.getConfig(TimelockConfig.TIMELOCK_CONFIG_ID).value;
    }

    function getInflationBps() public view override returns (uint256 inflationBps) {
        return TimelockConfig.getConfig(INFLATION_BPS_CONFIG_ID).value;
    }

    function getEpochDuration() public view override returns (uint256 epochDuration) {
        return TimelockConfig.getConfig(EPOCH_DURATION_CONFIG_ID).value;
    }
}
