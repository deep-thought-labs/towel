const { expect } = require("chai");
const { ethers } = require("hardhat");

const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const IERC20 = "0x36372b07";
const IERC20Metadata = "0xa219a025";
const IERC20Permit = "0x9d8ff7da";
const IERC5267 = "0x84b0196e";
const IERC1363 = "0xb0202a11";

async function deployTowel() {
  const Towel = await ethers.getContractFactory("Towel");
  const towel = await Towel.deploy();
  await towel.waitForDeployment();
  return towel;
}

async function permitDomain(towel) {
  return {
    name: "Towel",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: await towel.getAddress(),
  };
}

describe("Towel", function () {
  async function actors() {
    const [alice, bob, attacker, recipient] = await ethers.getSigners();
    return { alice, bob, attacker, recipient };
  }

  it("ERC-20 metadata and zero initial supply", async function () {
    const towel = await deployTowel();
    expect(await towel.name()).to.equal("Towel");
    expect(await towel.symbol()).to.equal("TOWEL");
    expect(await towel.decimals()).to.equal(18n);
    expect(await towel.totalSupply()).to.equal(0n);
  });

  it("supportsInterface advertises ERC-20, permit, domain, and ERC-1363", async function () {
    const towel = await deployTowel();
    expect(await towel.supportsInterface(IERC20)).to.equal(true);
    expect(await towel.supportsInterface(IERC20Metadata)).to.equal(true);
    expect(await towel.supportsInterface(IERC20Permit)).to.equal(true);
    expect(await towel.supportsInterface(IERC5267)).to.equal(true);
    expect(await towel.supportsInterface(IERC1363)).to.equal(true);
    expect(await towel.supportsInterface("0xffffffff")).to.equal(false);
  });

  it("totalSupply matches Improbability held by the contract", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("6");
    await towel.connect(alice).deposit({ value: wad });
    expect(await towel.totalSupply()).to.equal(wad);
    expect(await ethers.provider.getBalance(await towel.getAddress())).to.equal(wad);
  });

  it("full withdraw leaves supply and contract balance at zero", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("4");
    await towel.connect(alice).deposit({ value: wad });
    await towel.connect(alice).withdraw(wad);
    expect(await towel.totalSupply()).to.equal(0n);
    expect(await ethers.provider.getBalance(await towel.getAddress())).to.equal(0n);
  });

  it("deposit, receive, and withdraw", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("5");

    await expect(towel.connect(alice).deposit({ value: wad }))
      .to.emit(towel, "Deposit")
      .withArgs(alice.address, wad);
    expect(await towel.balanceOf(alice.address)).to.equal(wad);
    expect(await ethers.provider.getBalance(await towel.getAddress())).to.equal(wad);

    await expect(alice.sendTransaction({ to: await towel.getAddress(), value: wad }))
      .to.emit(towel, "Deposit")
      .withArgs(alice.address, wad);
    expect(await towel.balanceOf(alice.address)).to.equal(wad * 2n);

    const nativeBefore = await ethers.provider.getBalance(alice.address);
    const tx = await towel.connect(alice).withdraw(wad);
    const receipt = await tx.wait();
    const gas = receipt.gasUsed * receipt.gasPrice;
    expect(await towel.balanceOf(alice.address)).to.equal(wad);
    expect(await ethers.provider.getBalance(alice.address)).to.equal(nativeBefore + wad - gas);
  });

  it("depositTo and withdrawTo", async function () {
    const { alice, recipient } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("3");

    await expect(towel.connect(alice).depositTo(recipient.address, { value: wad }))
      .to.emit(towel, "Deposit")
      .withArgs(recipient.address, wad)
      .and.to.emit(towel, "DepositFor")
      .withArgs(alice.address, recipient.address, wad);
    expect(await towel.balanceOf(recipient.address)).to.equal(wad);

    const before = await ethers.provider.getBalance(alice.address);
    await expect(towel.connect(recipient).withdrawTo(alice.address, wad))
      .to.emit(towel, "Withdrawal")
      .withArgs(recipient.address, wad)
      .and.to.emit(towel, "WithdrawalTo")
      .withArgs(recipient.address, alice.address, wad);
    expect(await towel.balanceOf(recipient.address)).to.equal(0n);
    expect(await ethers.provider.getBalance(alice.address)).to.equal(before + wad);
  });

  it("zero-value deposit and withdraw are no-ops", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    const addr = await towel.getAddress();

    await expect(towel.connect(alice).deposit({ value: 0 }))
      .to.emit(towel, "Deposit")
      .withArgs(alice.address, 0n);
    await expect(towel.connect(alice).depositTo(alice.address, { value: 0 }))
      .to.emit(towel, "Deposit")
      .withArgs(alice.address, 0n);
    await expect(alice.sendTransaction({ to: addr, value: 0 }))
      .to.emit(towel, "Deposit")
      .withArgs(alice.address, 0n);
    await expect(towel.connect(alice).withdraw(0))
      .to.emit(towel, "Withdrawal")
      .withArgs(alice.address, 0n);
    expect(await towel.totalSupply()).to.equal(0n);
    expect(await towel.balanceOf(alice.address)).to.equal(0n);
  });

  it("InvalidRecipient on zero address, self, and ERC-20 transfer to contract", async function () {
    const { alice, bob } = await actors();
    const towel = await deployTowel();
    const addr = await towel.getAddress();
    const wad = ethers.parseEther("1");

    await expect(towel.depositTo(ethers.ZeroAddress, { value: 1 })).to.be.revertedWithCustomError(
      towel,
      "InvalidRecipient"
    );
    await expect(towel.connect(alice).depositTo(addr, { value: 1 })).to.be.revertedWithCustomError(
      towel,
      "InvalidRecipient"
    );
    await towel.connect(alice).deposit({ value: wad });
    await expect(towel.connect(alice).withdrawTo(addr, wad)).to.be.revertedWithCustomError(towel, "InvalidRecipient");
    await expect(towel.connect(alice).withdrawTo(ethers.ZeroAddress, 1)).to.be.revertedWithCustomError(
      towel,
      "InvalidRecipient"
    );
    await expect(towel.connect(alice).transfer(addr, wad)).to.be.revertedWithCustomError(towel, "InvalidRecipient");
    await expect(towel.connect(alice).transfer(bob.address, wad)).to.not.be.reverted;
  });

  it("withdraw and withdrawTo emit core Withdrawal events", async function () {
    const { alice, recipient } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("2");
    await towel.connect(alice).deposit({ value: wad });

    await expect(towel.connect(alice).withdraw(wad))
      .to.emit(towel, "Withdrawal")
      .withArgs(alice.address, wad);

    await towel.connect(alice).deposit({ value: wad });
    await expect(towel.connect(alice).withdrawTo(recipient.address, wad))
      .to.emit(towel, "Withdrawal")
      .withArgs(alice.address, wad)
      .and.to.emit(towel, "WithdrawalTo")
      .withArgs(alice.address, recipient.address, wad);
  });

  it("withdraw reverts without sufficient balance", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    await expect(towel.connect(alice).withdraw(1)).to.be.revertedWithCustomError(
      towel,
      "ERC20InsufficientBalance"
    );
    await expect(towel.connect(alice).withdrawTo(alice.address, 1)).to.be.revertedWithCustomError(
      towel,
      "ERC20InsufficientBalance"
    );
  });

  it("ERC-20 transfer moves balance", async function () {
    const { alice, bob } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("3");
    await towel.connect(alice).deposit({ value: wad });
    await towel.connect(alice).transfer(bob.address, wad);
    expect(await towel.balanceOf(alice.address)).to.equal(0n);
    expect(await towel.balanceOf(bob.address)).to.equal(wad);
  });

  it("approve and transferFrom", async function () {
    const { alice, bob, recipient } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("5");
    await towel.connect(alice).deposit({ value: wad });
    await towel.connect(alice).approve(bob.address, wad);
    await towel.connect(bob).transferFrom(alice.address, recipient.address, wad);
    expect(await towel.balanceOf(recipient.address)).to.equal(wad);
    expect(await towel.allowance(alice.address, bob.address)).to.equal(0n);
  });

  it("transferFrom skips allowance when caller is the source", async function () {
    const { alice, bob } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("2");
    await towel.connect(alice).deposit({ value: wad });
    await towel.connect(alice).transferFrom(alice.address, bob.address, wad);
    expect(await towel.balanceOf(bob.address)).to.equal(wad);
    expect(await towel.allowance(alice.address, alice.address)).to.equal(0n);
  });

  it("failed Improbability transfer reverts without affecting supply", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("2");
    await towel.connect(alice).deposit({ value: wad });

    const Reject = await ethers.getContractFactory("RejectImprobability");
    const sink = await Reject.deploy();
    await sink.waitForDeployment();
    const sinkAddr = await sink.getAddress();

    const supplyBefore = await towel.totalSupply();
    const balanceBefore = await ethers.provider.getBalance(await towel.getAddress());
    await expect(towel.connect(alice).withdrawTo(sinkAddr, wad))
      .to.be.revertedWithCustomError(towel, "ImprobabilityTransferFailed")
      .withArgs(sinkAddr, wad);
    expect(await towel.totalSupply()).to.equal(supplyBefore);
    expect(await towel.balanceOf(alice.address)).to.equal(wad);
    expect(await ethers.provider.getBalance(await towel.getAddress())).to.equal(balanceBefore);
  });

  it("reentrancy on withdraw reverts", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("4");
    await towel.connect(alice).deposit({ value: wad });

    const Attacker = await ethers.getContractFactory("ReenteringWithdrawer");
    const attacker = await Attacker.deploy(await towel.getAddress());
    await attacker.waitForDeployment();
    await towel.connect(alice).transfer(await attacker.getAddress(), wad);

    await expect(attacker.armAndWithdraw(wad)).to.be.reverted;
  });

  it("malicious ERC-1363 receiver cannot drain contract Improbability balance", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("7");
    await towel.connect(alice).deposit({ value: wad });

    const Drain = await ethers.getContractFactory("Malicious1363Drain");
    const drain = await Drain.deploy();
    await drain.waitForDeployment();

    const balanceBefore = await ethers.provider.getBalance(await towel.getAddress());
    await expect(towel.connect(alice).transferAndCall(await drain.getAddress(), wad)).to.be.reverted;
    expect(await ethers.provider.getBalance(await towel.getAddress())).to.equal(balanceBefore);
    expect(await towel.balanceOf(alice.address)).to.equal(wad);
  });

  it("transferAndCall to an honest receiver", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("2");
    await towel.connect(alice).deposit({ value: wad });

    const Mock = await ethers.getContractFactory("ERC1363ReceiverMock");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    const mockAddr = await mock.getAddress();

    const data = "0x1234";
    await expect(
      towel.connect(alice)["transferAndCall(address,uint256,bytes)"](mockAddr, wad, data)
    )
      .to.emit(towel, "Transfer")
      .withArgs(alice.address, mockAddr, wad);
    expect(await mock.lastValue()).to.equal(wad);
    expect(await mock.lastData()).to.equal(data);
  });

  it("transferAndCall without extra bytes", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("1");
    await towel.connect(alice).deposit({ value: wad });

    const Mock = await ethers.getContractFactory("ERC1363ReceiverMock");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    const mockAddr = await mock.getAddress();

    await towel.connect(alice)["transferAndCall(address,uint256)"](mockAddr, wad);
    expect(await mock.lastValue()).to.equal(wad);
    expect(await mock.lastData()).to.equal("0x");
  });

  it("transferFromAndCall with allowance", async function () {
    const { alice, bob } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("2");
    await towel.connect(alice).deposit({ value: wad });
    await towel.connect(alice).approve(bob.address, wad);

    const Mock = await ethers.getContractFactory("ERC1363ReceiverMock");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    const mockAddr = await mock.getAddress();

    await towel
      .connect(bob)
      ["transferFromAndCall(address,address,uint256,bytes)"](alice.address, mockAddr, wad, "0xab");
    expect(await towel.balanceOf(mockAddr)).to.equal(wad);
    expect(await mock.lastValue()).to.equal(wad);
  });

  it("approveAndCall to an ERC-1363 spender", async function () {
    const { alice } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("2");
    await towel.connect(alice).deposit({ value: wad });

    const Spender = await ethers.getContractFactory("ERC1363SpenderMock");
    const spender = await Spender.deploy();
    await spender.waitForDeployment();
    const spenderAddr = await spender.getAddress();

    await towel.connect(alice)["approveAndCall(address,uint256,bytes)"](spenderAddr, wad, "0xcd");
    expect(await towel.allowance(alice.address, spenderAddr)).to.equal(wad);
    expect(await spender.lastOwner()).to.equal(alice.address);
    expect(await spender.lastValue()).to.equal(wad);
  });

  it("valid permit; expired or wrong signer revert", async function () {
    const { alice, bob, attacker } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("10");
    await towel.connect(alice).deposit({ value: wad });

    const domain = await permitDomain(towel);
    const value = wad;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const nonce = await towel.nonces(alice.address);

    const ok = await alice.signTypedData(domain, PERMIT_TYPES, {
      owner: alice.address,
      spender: bob.address,
      value,
      nonce,
      deadline,
    });
    const sig = ethers.Signature.from(ok);
    await towel.permit(alice.address, bob.address, value, deadline, sig.v, sig.r, sig.s);
    expect(await towel.allowance(alice.address, bob.address)).to.equal(value);
    await towel.connect(bob).transferFrom(alice.address, attacker.address, value);
    expect(await towel.balanceOf(attacker.address)).to.equal(value);

    const expired = deadline - 7200n;
    const expSig = ethers.Signature.from(
      await alice.signTypedData(domain, PERMIT_TYPES, {
        owner: alice.address,
        spender: attacker.address,
        value,
        nonce: await towel.nonces(alice.address),
        deadline: expired,
      })
    );
    await expect(
      towel.permit(alice.address, attacker.address, value, expired, expSig.v, expSig.r, expSig.s)
    ).to.be.reverted;

    const stolen = ethers.Signature.from(
      await attacker.signTypedData(domain, PERMIT_TYPES, {
        owner: alice.address,
        spender: attacker.address,
        value,
        nonce: await towel.nonces(alice.address),
        deadline,
      })
    );
    await expect(
      towel.permit(alice.address, attacker.address, value, deadline, stolen.v, stolen.r, stolen.s)
    ).to.be.reverted;
  });

  it("permit with bytes signature (ERC-7597)", async function () {
    const { alice, bob } = await actors();
    const towel = await deployTowel();
    const wad = ethers.parseEther("3");
    await towel.connect(alice).deposit({ value: wad });

    const domain = await permitDomain(towel);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const nonce = await towel.nonces(alice.address);
    const signature = await alice.signTypedData(domain, PERMIT_TYPES, {
      owner: alice.address,
      spender: bob.address,
      value: wad,
      nonce,
      deadline,
    });

    await towel["permit(address,address,uint256,uint256,bytes)"](
      alice.address,
      bob.address,
      wad,
      deadline,
      signature
    );
    expect(await towel.allowance(alice.address, bob.address)).to.equal(wad);
    expect(await towel.nonces(alice.address)).to.equal(nonce + 1n);
  });
});
