// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import {IRageQuit, IUniversalVault} from "../crucible/Crucible.sol";

contract MockDelegate is IRageQuit {
    enum DelegateType {Succeed, Revert, RevertWithMessage, OOG}

    DelegateType private _delegateType;

    function setDelegateType(DelegateType delegateType) external {
        _delegateType = delegateType;
    }

    function rageQuit() external view override {
        if (_delegateType == DelegateType.Succeed) {
            return;
        } else if (_delegateType == DelegateType.Revert) {
            revert();
        } else if (_delegateType == DelegateType.RevertWithMessage) {
            require(false, "MockDelegate: revert with message");
        } else if (_delegateType == DelegateType.OOG) {
            while (true) {}
        }
    }

    function lock(
        address vault,
        address token,
        uint256 amount,
        bytes memory permission
    ) external {
        IUniversalVault(vault).lock(token, amount, permission);
    }

    function unlock(
        address vault,
        address token,
        uint256 amount,
        bytes memory permission
    ) external {
        IUniversalVault(vault).unlock(token, amount, permission);
    }
}
