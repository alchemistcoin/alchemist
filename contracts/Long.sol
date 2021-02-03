// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
// pragma experimental SMTChecker;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

// todo: add permit interface
// todo: make inflation continuous
// todo: use unicode symbol ♾️
contract Long is ERC20("Long", "unicode"), ERC20Burnable {
    /* storage */

    address public immutable tokenManager;
    uint256 public immutable inflationPts;
    uint256 public immutable epochLength;
    uint256 public epochStart;

    /* constructor function */

    constructor(
        address _tokenManager,
        uint256 _supply,
        uint256 _inflationPts,
        uint256 _epochLength
    ) {
        // set immutables
        tokenManager = _tokenManager;
        inflationPts = _inflationPts;
        epochLength = _epochLength;
        // mint initial supply
        ERC20._mint(_tokenManager, _supply);
    }

    /* user functions */

    function advance() external {
        // require new epoch
        require(block.timestamp >= epochStart + epochLength, "Long: not ready to advance");
        // calculate inflation amount
        uint256 amount = (ERC20.totalSupply() * inflationPts) / 10000;
        // mint to tokenManager
        ERC20._mint(tokenManager, amount);
    }
}
