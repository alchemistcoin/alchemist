// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import {EnumerableSet} from "@openzeppelin/contracts/utils/EnumerableSet.sol";

interface ITimelockConfig {
    /* data types */

    struct Config {
        bytes32 id;
        uint256 value;
    }

    struct PendingRequest {
        bytes32 id;
        uint256 value;
        uint256 timestamp;
    }

    /* events */

    event ChangeRequested(bytes32 configID, uint256 value);
    event ChangeConfirmed(bytes32 configID, uint256 value);
    event ChangeCanceled(bytes32 configID, uint256 value);

    /* user functions */

    function confirmChange(bytes32 configID) external;

    /* admin functions */

    function requestChange(bytes32 configID, uint256 value) external;

    function cancelChange(bytes32 configID) external;

    /* pure functions */

    function calculateConfigID(string memory name) external pure returns (bytes32 configID);

    /* view functions */

    function getConfig(bytes32 configID) external view returns (Config memory config);

    function isConfig(bytes32 configID) external view returns (bool status);

    function getConfigCount() external view returns (uint256 count);

    function getConfigByIndex(uint256 index) external view returns (Config memory config);

    function getPending(bytes32 configID)
        external
        view
        returns (PendingRequest memory pendingRequest);

    function isPending(bytes32 configID) external view returns (bool status);

    function getPendingCount() external view returns (uint256 count);

    function getPendingByIndex(uint256 index)
        external
        view
        returns (PendingRequest memory pendingRequest);
}

contract TimelockConfig is ITimelockConfig {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /* constants */

    bytes32 public constant ADMIN_CONFIG_ID = keccak256("Admin");
    bytes32 public constant TIMELOCK_CONFIG_ID = keccak256("Timelock");

    /* storage */

    struct InternalPending {
        uint256 value;
        uint256 timestamp;
    }

    mapping(bytes32 => uint256) _config;
    EnumerableSet.Bytes32Set _configSet;

    mapping(bytes32 => InternalPending) _pending;
    EnumerableSet.Bytes32Set _pendingSet;

    /* modifiers */

    modifier onlyAdmin() {
        require(msg.sender == address(_config[ADMIN_CONFIG_ID]), "only admin");
        _;
    }

    /* constructor */

    constructor(address admin, uint256 timelock) {
        _setRawConfig(ADMIN_CONFIG_ID, uint256(admin));
        _setRawConfig(TIMELOCK_CONFIG_ID, timelock);
    }

    /* user functions */

    function confirmChange(bytes32 configID) external override {
        // require sufficient time elapsed
        require(
            block.timestamp >= _pending[configID].timestamp + _config[TIMELOCK_CONFIG_ID],
            "too early"
        );

        // get pending value
        uint256 value = _pending[configID].value;

        // commit change
        _configSet.add(configID);
        _config[configID] = value;

        // delete pending
        _pendingSet.remove(configID);
        delete _pending[configID];

        // emit event
        emit ChangeConfirmed(configID, value);
    }

    /* admin functions */

    function requestChange(bytes32 configID, uint256 value) external override onlyAdmin {
        // add to pending set
        require(_pendingSet.add(configID), "existing request");

        // lock new value
        _pending[configID] = InternalPending(value, block.timestamp);

        // emit event
        emit ChangeRequested(configID, value);
    }

    function cancelChange(bytes32 configID) external override onlyAdmin {
        // remove from pending set
        require(_pendingSet.remove(configID), "no request");

        // get pending value
        uint256 value = _pending[configID].value;

        // delete pending
        delete _pending[configID];

        // emit event
        emit ChangeCanceled(configID, value);
    }

    /* convenience functions */

    function _setRawConfig(bytes32 configID, uint256 value) internal {
        // commit change
        _configSet.add(configID);
        _config[configID] = value;

        // emit event
        emit ChangeRequested(configID, value);
        emit ChangeConfirmed(configID, value);
    }

    /* pure functions */

    function calculateConfigID(string memory name) public pure override returns (bytes32 configID) {
        return keccak256(abi.encodePacked(name));
    }

    /* view functions */

    function isConfig(bytes32 configID) public view override returns (bool status) {
        return _configSet.contains(configID);
    }

    function getConfigCount() public view override returns (uint256 count) {
        return _configSet.length();
    }

    function getConfigByIndex(uint256 index)
        public
        view
        override
        returns (ITimelockConfig.Config memory config)
    {
        // get config ID
        bytes32 configID = _configSet.at(index);
        // return config
        return ITimelockConfig.Config(configID, _config[configID]);
    }

    function getConfig(bytes32 configID)
        public
        view
        override
        returns (ITimelockConfig.Config memory config)
    {
        // check for existance
        require(_configSet.contains(configID), "not config");
        // return config
        return ITimelockConfig.Config(configID, _config[configID]);
    }

    function isPending(bytes32 configID) public view override returns (bool status) {
        return _pendingSet.contains(configID);
    }

    function getPendingCount() public view override returns (uint256 count) {
        return _pendingSet.length();
    }

    function getPendingByIndex(uint256 index)
        public
        view
        override
        returns (ITimelockConfig.PendingRequest memory pendingRequest)
    {
        // get config ID
        bytes32 configID = _pendingSet.at(index);
        // return config
        return
            ITimelockConfig.PendingRequest(
                configID,
                _pending[configID].value,
                _pending[configID].timestamp
            );
    }

    function getPending(bytes32 configID)
        public
        view
        override
        returns (ITimelockConfig.PendingRequest memory pendingRequest)
    {
        // check for existance
        require(_pendingSet.contains(configID), "not pending");
        // return config
        return
            ITimelockConfig.PendingRequest(
                configID,
                _pending[configID].value,
                _pending[configID].timestamp
            );
    }
}
