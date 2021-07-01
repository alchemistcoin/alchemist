// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IAlchemist} from "./alchemist/Alchemist.sol";
import {IAludel} from "./aludel/Aludel.sol";

contract StreamV2 is Ownable {
    using SafeMath for uint256;

    address public immutable mist;

    address[] public recipients;
    uint256[] public shareBPS;
    uint256[] public fundDuration;

    event Distributed(uint256 amtMinted);
    event RecipientsUpdated(address[] _recipients, uint256[] _shareBPS, uint256[] _fundDuration);
    event FunctionCall(address target, bytes data);

    constructor(address _mist, address _owner) {
        mist = _mist;
        Ownable.transferOwnership(_owner);
    }

    /* user functions */

    function advanceAndDistribute() external {
        // call advance if possible
        try IAlchemist(mist).advance() {} catch {}
        // distribute
        distribute();
    }

    function distribute() public {
        // get balance
        uint256 balance = IERC20(mist).balanceOf(address(this));
        // transfer to recipients
        for (uint256 index = 0; index < recipients.length; index++) {
            // perform if fund duration is set and recipient is a contract
            if (fundDuration[index] > 0 && Address.isContract(recipients[index])) {
                // get approval for token transfer
                IERC20(mist).approve(recipients[index], balance.mul(shareBPS[index]).div(10_000));
                // call fund function directly to reward program contract
                IAludel(recipients[index]).fund(
                    balance.mul(shareBPS[index]).div(10_000),
                    fundDuration[index]
                );
            } else {
                IERC20(mist).transfer(recipients[index], balance.mul(shareBPS[index]).div(10_000));
            }
        }
        // emit event
        emit Distributed(balance);
    }

    /* admin functions */

    function updateRecipients(
        address[] calldata _recipients,
        uint256[] calldata _shareBPS,
        uint256[] calldata _fundDuration
    ) external onlyOwner {
        // clear storage
        delete recipients;
        delete shareBPS;
        delete fundDuration;

        assert(recipients.length == 0 && shareBPS.length == 0 && fundDuration.length == 0);
        // sumBPS distribution
        uint256 sumBPS = 0;
        for (uint256 index = 0; index < _recipients.length; index++) {
            sumBPS += _shareBPS[index];
        }
        require(sumBPS == 10_000, "invalid sum");
        // update storage
        recipients = _recipients;
        shareBPS = _shareBPS;
        fundDuration = _fundDuration;
        // emit event
        emit RecipientsUpdated(_recipients, _shareBPS, _fundDuration);
    }

    /* admin functions - arbitrary external call forwarding */

    function _functionCall(address target, bytes memory data) external onlyOwner {
        Address.functionCall(target, data, "external call failed");
        // emit event
        emit FunctionCall(target, data);
    }
}
