// SPDX-License-Identifier: MIT
// Deep Thought Labs — Towel (contracts/Towel.sol)

pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC1363} from "@openzeppelin/contracts/token/ERC20/extensions/ERC1363.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IERC5267} from "@openzeppelin/contracts/interfaces/IERC5267.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @title Towel
/// @notice A towel is the most useful thing you can carry.
contract Towel is ERC20Permit, ERC1363 {
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    event DepositFor(address indexed payer, address indexed dst, uint256 wad);
    event WithdrawalTo(address indexed src, address indexed dst, uint256 wad);

    error InvalidRecipient(address to);
    error ImprobabilityTransferFailed(address to, uint256 amount);

    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    constructor() ERC20("Towel", "TOWEL") ERC20Permit("Towel") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    receive() external payable {
        _credit(msg.sender, msg.value);
    }

    function deposit() public payable {
        _credit(msg.sender, msg.value);
    }

    function depositTo(address to) public payable {
        _checkRecipient(to);
        _credit(to, msg.value);
        emit DepositFor(msg.sender, to, msg.value);
    }

    function withdraw(uint256 amount) public {
        _burn(msg.sender, amount);
        emit Withdrawal(msg.sender, amount);
        _send(msg.sender, amount);
    }

    function withdrawTo(address to, uint256 amount) public {
        _checkRecipient(to);
        _burn(msg.sender, amount);
        emit Withdrawal(msg.sender, amount);
        emit WithdrawalTo(msg.sender, to, amount);
        _send(to, amount);
    }

    function transferFrom(address from, address to, uint256 value) public override(ERC20, IERC20) returns (bool) {
        if (from != _msgSender()) {
            _spendAllowance(from, _msgSender(), value);
        }
        _transfer(from, to, value);
        return true;
    }

    function permit(address owner, address spender, uint256 value, uint256 deadline, bytes calldata signature) public {
        if (block.timestamp > deadline) {
            revert ERC2612ExpiredSignature(deadline);
        }
        bytes32 digest =
            _hashTypedDataV4(keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline)));
        if (!SignatureChecker.isValidSignatureNow(owner, digest, signature)) {
            revert ERC2612InvalidSigner(address(0), owner);
        }
        _approve(owner, spender, value);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1363) returns (bool) {
        return interfaceId == type(IERC20).interfaceId || interfaceId == type(IERC20Metadata).interfaceId
            || interfaceId == type(IERC20Permit).interfaceId || interfaceId == type(IERC5267).interfaceId
            || super.supportsInterface(interfaceId);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (to == address(this)) revert InvalidRecipient(to);
        super._update(from, to, value);
    }

    function _checkRecipient(address to) private view {
        if (to == address(0) || to == address(this)) revert InvalidRecipient(to);
    }

    function _credit(address to, uint256 amount) private {
        _mint(to, amount);
        emit Deposit(to, amount);
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert ImprobabilityTransferFailed(to, amount);
    }
}
