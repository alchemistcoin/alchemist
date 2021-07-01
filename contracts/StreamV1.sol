// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IAlchemist} from "./alchemist/Alchemist.sol";

contract StreamV1 is Ownable {
    using SafeMath for uint256;

    address public immutable mist;

    address[] public recipients;
    uint256[] public shareBPS;

    event Distributed(uint256 amtMinted);
    event RecipientsUpdated(address[] _recipients, uint256[] _shareBPS);

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
            IERC20(mist).transfer(recipients[index], balance.mul(shareBPS[index]).div(10_000));
        }
        // emit event
        emit Distributed(balance);
    }

    /* admin functions */

    function updateRecipients(address[] calldata _recipients, uint256[] calldata _shareBPS)
        external
        onlyOwner
    {
        // clear storage
        delete recipients;
        delete shareBPS;
        assert(recipients.length == 0 && shareBPS.length == 0);
        // sumBPS distribution
        uint256 sumBPS = 0;
        for (uint256 index = 0; index < _recipients.length; index++) {
            sumBPS += _shareBPS[index];
        }
        require(sumBPS == 10_000, "invalid sum");
        // update storage
        recipients = _recipients;
        shareBPS = _shareBPS;
        // emit event
        emit RecipientsUpdated(_recipients, _shareBPS);
    }
}