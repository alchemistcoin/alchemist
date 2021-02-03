// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
// pragma experimental SMTChecker;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

// todo: add permit interface
// todo: make inflation continuous
// todo: use unicode symbol ♾️
contract Long is ERC20("Long", "unicode"), ERC20Burnable {
    address public immutable distributor;
    uint256 public immutable inflationPts;
    uint256 public immutable epochLength;
    uint256 public epochStart;

    constructor(
        address _distributor,
        uint256 _supply,
        uint256 _inflationPts,
        uint256 _epochLength
    ) {
        // set immutables
        distributor = _distributor;
        inflationPts = _inflationPts;
        epochLength = _epochLength;
        // mint initial supply
        ERC20._mint(_distributor, _supply);
    }

    function advance() external {
        // require new epoch
        require(block.timestamp >= epochStart + epochLength, "Long: not ready to advance");
        // calculate inflation amount
        uint256 amount = (ERC20.totalSupply() * inflationPts) / 10000;
        // mint to distributor
        ERC20._mint(distributor, amount);
    }
}
