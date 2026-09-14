// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC1363Receiver} from "@openzeppelin/contracts/interfaces/IERC1363Receiver.sol";
import {IERC1363Spender} from "@openzeppelin/contracts/interfaces/IERC1363Spender.sol";

interface ITowel {
    function withdraw(uint256 amount) external;
    function withdrawTo(address to, uint256 amount) external;
}

contract ERC1363SpenderMock is IERC1363Spender {
    bytes public lastData;
    uint256 public lastValue;
    address public lastOwner;

    function onApprovalReceived(
        address owner,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4) {
        lastOwner = owner;
        lastValue = value;
        lastData = data;
        return IERC1363Spender.onApprovalReceived.selector;
    }
}

contract ERC1363ReceiverMock is IERC1363Receiver {
    bytes public lastData;
    uint256 public lastValue;

    function onTransferReceived(
        address,
        address,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4) {
        lastValue = value;
        lastData = data;
        return IERC1363Receiver.onTransferReceived.selector;
    }
}

/// @dev Calls withdraw with max amount during ERC-1363 callback (drain attempt).
contract Malicious1363Drain is IERC1363Receiver {
    function onTransferReceived(
        address,
        address,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        ITowel(msg.sender).withdraw(type(uint256).max);
        return IERC1363Receiver.onTransferReceived.selector;
    }
}

/// @dev Reenters withdraw from the Improbability receive callback.
contract ReenteringWithdrawer {
    ITowel public towel;
    bool private entered;

    constructor(address towel_) {
        towel = ITowel(towel_);
    }

    function armAndWithdraw(uint256 amount) external {
        entered = false;
        towel.withdraw(amount);
    }

    receive() external payable {
        if (!entered) {
            entered = true;
            towel.withdraw(1);
        }
    }
}

contract RejectImprobability {
    receive() external payable {
        revert("nope");
    }
}
