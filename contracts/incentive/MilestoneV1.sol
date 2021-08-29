// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/EnumerableSet.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";

interface IMilestoneV1 {
    enum Status {Active, Completed, Failed}

    struct MilestoneData {
        address manager;
        address token;
        uint256 start;
        uint256 cliff;
        Status status;
    }

    struct AllocationData {
        uint256 amount;
        uint256 duration;
        uint256 lastClaim;
    }

    struct AllocationInput {
        address builder;
        uint256 cashAmount;
        uint256 lockedAmount;
        uint256 duration;
    }

    event Allocate(address builder, uint256 cashAmount, uint256 lockedAmount, uint256 duration);
    event Cliff(bool success);
    event Claim(address builder, uint256 amount);

    function getMilestoneData() external view returns (MilestoneData memory milestone);

    function allocate(AllocationInput calldata input) external;

    function cliff(bool success) external;

    function claim() external;
}

/// Implementations details:
/// - each milestone has its own contract which is initialized by the incentive manager
/// - milestone with immediate cliff becomes pure timelock
/// - cliff is collective, start, amount, and duration are allocation specific
/// - provides audit trail for cash amount and locked amount
/// todo:
/// -
/// note:
/// - not compatible with rebasing / scaling tokens
contract MilestoneV1 is IMilestoneV1 {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    MilestoneData public _milestone;

    EnumerableSet.AddressSet private _builderSet;
    mapping(address => AllocationData[]) public _allocations;

    constructor(
        address manager,
        address token,
        uint256 start
    ) {
        _milestone.manager = manager;
        _milestone.token = token;
        _milestone.start = start;
    }

    function getMilestoneData() external view override returns (MilestoneData memory milestone) {
        return _milestone;
    }

    function hasBuilder(address builder) external view returns (bool validity) {
        return _builderSet.contains(builder);
    }

    function getBuiderAt(uint256 index) external view returns (address builder) {
        return _builderSet.at(index);
    }

    function builderCount() external view returns (uint256 count) {
        return _builderSet.length();
    }

    function getAmount(address builder) public view returns (uint256 amount) {
        for (uint256 index = 0; index < _allocations[builder].length; index++) {
            AllocationData memory allocation = _allocations[builder][index];

            // elapsed% = (now - lastClaim) / duration
            // claimable = initialAmount * elapsed%
            // note: not compatible with rebasing tokens
            amount = amount.add(
                allocation.amount.mul(block.timestamp.sub(allocation.lastClaim)).div(
                    allocation.duration
                )
            );
        }
    }

    function getClaimableAmount(address builder) public view returns (uint256 amount) {
        if (_milestone.status != IMilestoneV1.Status.Completed) {
            return 0;
        } else {
            return getAmount(builder);
        }
    }

    function allocate(AllocationInput calldata input) public override {
        // check status
        require(_milestone.status != IMilestoneV1.Status.Failed, "bad state");

        // check permissions
        require(msg.sender == _milestone.manager, "not manager");

        // craft allocation data
        AllocationData memory allocation =
            AllocationData(input.lockedAmount, input.duration, block.timestamp);

        // store allocation
        _allocations[input.builder].push(allocation);

        // add builder to set
        _builderSet.add(input.builder);

        // transfer cash amount to builder
        TransferHelper.safeTransferFrom(
            _milestone.token,
            msg.sender,
            input.builder,
            input.cashAmount
        );

        // deposit locked tokens
        TransferHelper.safeTransferFrom(
            _milestone.token,
            msg.sender,
            address(this),
            input.lockedAmount
        );

        // emit event
        emit Allocate(input.builder, input.cashAmount, input.lockedAmount, input.duration);
    }

    function cliff(bool success) external override {
        // check status
        require(_milestone.status == IMilestoneV1.Status.Active, "bad state");

        // check permissions
        require(msg.sender == _milestone.manager, "not manager");

        // update status
        if (success) {
            // update milestone data
            _milestone.cliff = block.timestamp;
            _milestone.status = IMilestoneV1.Status.Completed;
        } else {
            // update milestone data
            _milestone.status = IMilestoneV1.Status.Failed;
            // withdraw
            withdraw(_milestone.token);
        }

        // emit event
        emit Cliff(success);
    }

    function withdraw(address token) public {
        // check status
        require(_milestone.status == IMilestoneV1.Status.Failed, "bad state");

        // withdraw tokens
        uint256 balance = IERC20(token).balanceOf(address(this));
        TransferHelper.safeTransfer(token, _milestone.manager, balance);
    }

    function claim() external override {
        // check status
        require(_milestone.status == IMilestoneV1.Status.Completed, "bad state");

        // check permission
        require(_builderSet.contains(msg.sender), "not builder");

        // calculate claimable amount across all allocations
        uint256 amount = getClaimableAmount(msg.sender);

        // transfer tokens
        TransferHelper.safeTransfer(_milestone.token, msg.sender, amount);

        // emit event
        emit Claim(msg.sender, amount);
    }
}
