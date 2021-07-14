// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import {ERC1271} from "../crucible/ERC1271.sol";

contract MockSmartWallet is ERC1271 {
    address private _owner;

    constructor(address owner) {
        _owner = owner;
    }

    function _getOwner() internal view override returns (address) {
        return _owner;
    }
}
