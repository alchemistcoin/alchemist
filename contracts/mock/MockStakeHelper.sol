// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;
pragma abicoder v2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Aludel} from "../aludel/Aludel.sol";

contract MockStakeHelper {
    function flashStake(
        address geyser,
        address vault,
        uint256 amount,
        bytes calldata lockPermission,
        bytes calldata unstakePermission
    ) external {
        Aludel(geyser).stake(vault, amount, lockPermission);
        Aludel(geyser).unstakeAndClaim(vault, amount, unstakePermission);
    }

    function stakeBatch(
        address[] calldata geysers,
        address[] calldata vaults,
        uint256[] calldata amounts,
        bytes[] calldata permissions
    ) external {
        for (uint256 index = 0; index < vaults.length; index++) {
            Aludel(geysers[index]).stake(vaults[index], amounts[index], permissions[index]);
        }
    }
}
