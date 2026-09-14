# Using Towel

Identity is in [README.md](../README.md). Notes from source are in [from-source.md](from-source.md).

## ABI

[`Towel.abi.json`](Towel.abi.json) is Towel's ABI — the list of functions and events your wallet or app needs to call the contract.

---

## How to use

### Overview

Towel is the token you take into a market, an app, or a place you walk into. Same balance in a wallet swap, a pool, an agent that pays on your behalf, or a room that charges at the door — one asset, many doors.

You keep it, send it, let an app pull it, or pay a contract that must react the moment it arrives. That is the whole point: something builders can plug in so you do not carry a different token for every action.

---

### Pay someone

Send TOWEL from your wallet to theirs.

```solidity
transfer(address to, uint256 amount)
```

---

### Let an app pull TOWEL from you

Approve the app once; it moves tokens when you swap, join a pool, or settle.

```solidity
approve(address spender, uint256 amount)
transferFrom(address from, address to, uint256 amount)
```

---

### Approve with a signature

Sign permission off-chain; the app submits it instead of a separate `approve` transaction.

```solidity
permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
```

Smart accounts (Safes, ERC-4337) use the bytes-signature overload:

```solidity
permit(address owner, address spender, uint256 value, uint256 deadline, bytes signature)
```

---

### Pay a contract that must react when tokens arrive

The receiver gets TOWEL and runs a callback in the same transaction.

```solidity
transferAndCall(address to, uint256 amount, bytes data)
```

---

## Getting Towel and giving it back

### Overview

Send **Improbability** to get TOWEL; redeem TOWEL through the contract to receive Improbability back.

---

### TOWEL to yourself

Call `deposit` with Improbability attached, or send Improbability to the Towel contract with no calldata.

```solidity
deposit{value: amount}()
receive()   // plain Improbability transfer, empty calldata
```

---

### TOWEL to someone else while you pay

You attach Improbability; they receive TOWEL.

```solidity
depositTo{value: amount}(address to)
```

---

### Redeem to yourself

Burn TOWEL from your balance; Improbability is sent to you.

```solidity
withdraw(uint256 amount)
```

---

### Redeem to another address

Burn your TOWEL; Improbability goes to `to`.

```solidity
withdrawTo(address to, uint256 amount)
```

---

## What you carry

Towel is the thing you carry. What you make of it is up to you.

Someone will dry with it. Someone else will take the galaxy.
