import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'
import { deployContract } from './utils'

describe('RewardPool', function () {
  let accounts: SignerWithAddress[]
  let PowerSwitch: Contract
  let ERC20: Contract
  let Mock: Contract
  const amount = ethers.utils.parseEther('10')

  beforeEach(async function () {
    // prepare signers
    accounts = await ethers.getSigners()
    // deploy mock
    PowerSwitch = await deployContract('PowerSwitch', [accounts[1].address])
    Mock = await deployContract('RewardPool', [PowerSwitch.address])
    ERC20 = await deployContract('MockERC20', [Mock.address, amount])
  })

  describe('sendERC20', function () {
    it('should succeed if msg.sender is admin', async function () {
      await Mock.connect(accounts[0]).sendERC20(ERC20.address, accounts[0].address, amount)
    })
    it('should fail if msg.sender is controller', async function () {
      await expect(Mock.connect(accounts[1]).sendERC20(ERC20.address, accounts[0].address, amount)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )
    })
    it('should succeed if online', async function () {
      expect(await Mock.isOnline()).to.eq(true)
      await Mock.connect(accounts[0]).sendERC20(ERC20.address, accounts[0].address, amount)
    })
    it('should fail if offline', async function () {
      await PowerSwitch.connect(accounts[1]).powerOff()
      expect(await Mock.isOffline()).to.eq(true)
      await expect(Mock.connect(accounts[0]).sendERC20(ERC20.address, accounts[0].address, amount)).to.be.revertedWith(
        'Powered: is not online',
      )
    })
    it('should fail if shutdown', async function () {
      await PowerSwitch.connect(accounts[1]).emergencyShutdown()
      expect(await Mock.isShutdown()).to.eq(true)
      await expect(Mock.connect(accounts[0]).sendERC20(ERC20.address, accounts[0].address, amount)).to.be.revertedWith(
        'Powered: is not online',
      )
    })
    it('should succeed with full balance', async function () {
      let txPromise = Mock.connect(accounts[0]).sendERC20(ERC20.address, accounts[0].address, amount)
      await expect(txPromise).to.emit(ERC20, 'Transfer').withArgs(Mock.address, accounts[0].address, amount)
    })
    it('should succeed with partial balance', async function () {
      let txPromise = Mock.connect(accounts[0]).sendERC20(ERC20.address, accounts[0].address, amount.div(2))
      await expect(txPromise).to.emit(ERC20, 'Transfer').withArgs(Mock.address, accounts[0].address, amount.div(2))
    })
    it('should succeed with no balance', async function () {
      let txPromise = Mock.connect(accounts[0]).sendERC20(ERC20.address, accounts[0].address, '0')
      await expect(txPromise).to.emit(ERC20, 'Transfer').withArgs(Mock.address, accounts[0].address, '0')
    })
  })

  describe('rescueERC20', function () {
    it('should fail if msg.sender is admin', async function () {
      await PowerSwitch.connect(accounts[1]).emergencyShutdown()
      await expect(Mock.connect(accounts[0]).rescueERC20([ERC20.address], accounts[0].address)).to.be.revertedWith(
        'RewardPool: only controller can withdraw after shutdown',
      )
    })
    it('should succeed if msg.sender is controller', async function () {
      await PowerSwitch.connect(accounts[1]).emergencyShutdown()
      await Mock.connect(accounts[1]).rescueERC20([ERC20.address], accounts[0].address)
    })
    it('should fail if online', async function () {
      expect(await Mock.isOnline()).to.eq(true)
      expect(await PowerSwitch.isOnline()).to.eq(true)
      await expect(Mock.connect(accounts[1]).rescueERC20([ERC20.address], accounts[0].address)).to.be.revertedWith(
        'Powered: is not shutdown',
      )
    })
    it('should fail if offline', async function () {
      await PowerSwitch.connect(accounts[1]).powerOff()
      expect(await Mock.isOffline()).to.eq(true)
      await expect(Mock.connect(accounts[1]).rescueERC20([ERC20.address], accounts[0].address)).to.be.revertedWith(
        'Powered: is not shutdown',
      )
    })
    it('should succeed if shutdown', async function () {
      await PowerSwitch.connect(accounts[1]).emergencyShutdown()
      expect(await Mock.isShutdown()).to.eq(true)
      await Mock.connect(accounts[1]).rescueERC20([ERC20.address], accounts[0].address)
    })
    it('should fail if recipient is not defined', async function () {
      await PowerSwitch.connect(accounts[1]).emergencyShutdown()
      expect(await Mock.isShutdown()).to.eq(true)
      await expect(
        Mock.connect(accounts[1]).rescueERC20([ERC20.address], ethers.constants.AddressZero),
      ).to.be.revertedWith('RewardPool: recipient not defined')
    })
    it('should succeed with single token', async function () {
      await PowerSwitch.connect(accounts[1]).emergencyShutdown()
      expect(await Mock.isShutdown()).to.eq(true)
      let txPromise = Mock.connect(accounts[1]).rescueERC20([ERC20.address], accounts[0].address)
      await expect(txPromise).to.emit(ERC20, 'Transfer').withArgs(Mock.address, accounts[0].address, amount)
    })
    it('should succeed with 100 tokens', async function () {
      await PowerSwitch.connect(accounts[1]).emergencyShutdown()
      expect(await Mock.isShutdown()).to.eq(true)
      let num = 100
      let tokens = []
      for (let index = 0; index < num; index++) {
        tokens.push(await deployContract('MockERC20', [Mock.address, amount]))
      }
      let txPromise = Mock.connect(accounts[1]).rescueERC20(
        tokens.map((token) => token.address),
        accounts[0].address,
      )
      for (let index = 0; index < num; index++) {
        await expect(txPromise).to.emit(tokens[index], 'Transfer').withArgs(Mock.address, accounts[0].address, amount)
      }
    })
  })
})
