// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import {Powered} from "../aludel/Powered.sol";

contract MockPowered is Powered {
    constructor(address powerSwitch) {
        Powered._setPowerSwitch(powerSwitch);
    }

    function onlyOnlineCall() public view onlyOnline {
        return;
    }

    function onlyOfflineCall() public view onlyOffline {
        return;
    }

    function notShutdownCall() public view notShutdown {
        return;
    }

    function onlyShutdownCall() public view onlyShutdown {
        return;
    }
}
