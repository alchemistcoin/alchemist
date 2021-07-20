// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import {IMilestoneV1, MilestoneV1} from "./MilestoneV1.sol";
import {TokenManager} from "./../TokenManager.sol";
import {InstanceRegistry} from "./../factory/InstanceRegistry.sol";

/// Implementations details:
/// - support for creating and managing MilestoneV1 contracts
/// - able to receive inflation directly
/// - owner has full control of tokens under management
/// - supports multiple tokens and multiple milestones
/// todo:
/// - consider restricting returning tokens to higher level manager
/// - consider adding ability to transfer milestone ownership
/// - consider using proxies for milestones
/// - consider sharing milestone factory across multiple managers
/// note:
/// -
contract MilestoneManager is TokenManager, InstanceRegistry {
    using SafeMath for uint256;

    struct AllocationInput {
        address milestone;
        address builder;
        uint256 cashAmount;
        uint256 lockedAmount;
        uint256 duration;
    }

    function createMilestone(address token, uint256 start) external returns (address milestone) {
        // create milestone
        milestone = address(new MilestoneV1(address(this), token, start));

        // store in registry
        InstanceRegistry._register(milestone);

        // return address
        return milestone;
    }

    function allocate(AllocationInput calldata input) public {
        // check valid milestone
        require(InstanceRegistry.isInstance(input.milestone), "not milestone");

        // fetch token address
        address token = IMilestoneV1(input.milestone).getMilestoneData().token;

        // approve token transfer
        TransferHelper.safeApprove(
            token,
            input.milestone,
            input.cashAmount.add(input.lockedAmount)
        );

        // set allocation
        IMilestoneV1(input.milestone).allocate(
            IMilestoneV1.AllocationInput(
                input.builder,
                input.cashAmount,
                input.lockedAmount,
                input.duration
            )
        );
    }

    function allocateMulti(AllocationInput[] calldata inputs) external {
        for (uint256 index = 0; index < inputs.length; index++) {
            allocate(inputs[index]);
        }
    }

    function cliff(address milestone, bool success) external {
        IMilestoneV1(milestone).cliff(success);
    }
}
