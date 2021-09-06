import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'
import { deployContract } from '../utils'

describe('PowerSwitch', function () {
  let accounts: SignerWithAddress[]
  let Mock: Contract

  beforeEach(async function () {
    // prepare signers
    accounts = await ethers.getSigners()
    // deploy mock
    Mock = await deployContract('PowerSwitch', [accounts[0].address])
  })

  describe('powerOn', function () {
    it('should fail if msg.sender is not admin', async function () {
      expect(await Mock.getPowerController()).to.eq(accounts[0].address)
      await Mock.connect(accounts[0]).powerOff()
      await expect(Mock.connect(accounts[1]).powerOn()).to.be.revertedWith('Ownable: caller is not the owner')
    })
    it('should succeed if in offline state', async function () {
      await Mock.connect(accounts[0]).powerOff()
      await Mock.connect(accounts[0]).powerOn()
    })
    it('should fail if in online state', async function () {
      await expect(Mock.connect(accounts[0]).powerOn()).to.be.revertedWith('PowerSwitch: cannot power on')
    })
    it('should fail if in shutdown state', async function () {
      await Mock.connect(accounts[0]).emergencyShutdown()
      await expect(Mock.connect(accounts[0]).powerOn()).to.be.revertedWith('PowerSwitch: cannot power on')
    })
    it('should succeed and emit event', async function () {
      await Mock.connect(accounts[0]).powerOff()
      const txPromise = Mock.connect(accounts[0]).powerOn()
      // validate event
      await expect(txPromise).to.emit(Mock, 'PowerOn')
      // validate state
      expect(await Mock.isOnline()).to.eq(true)
      expect(await Mock.isOffline()).to.eq(false)
      expect(await Mock.isShutdown()).to.eq(false)
      expect(await Mock.getStatus()).to.eq(0)
    })
  })

  describe('powerOff', function () {
    it('should fail if msg.sender is not admin', async function () {
      expect(await Mock.getPowerController()).to.eq(accounts[0].address)
      await expect(Mock.connect(accounts[1]).powerOff()).to.be.revertedWith('Ownable: caller is not the owner')
    })
    it('should succeed if in online state', async function () {
      await Mock.connect(accounts[0]).powerOff()
    })
    it('should fail if in offline state', async function () {
      await Mock.connect(accounts[0]).powerOff()
      await expect(Mock.connect(accounts[0]).powerOff()).to.be.revertedWith('PowerSwitch: cannot power off')
    })
    it('should fail if in shutdown state', async function () {
      await Mock.connect(accounts[0]).emergencyShutdown()
      await expect(Mock.connect(accounts[0]).powerOff()).to.be.revertedWith('PowerSwitch: cannot power off')
    })
    it('should succeed and emit event', async function () {
      const txPromise = Mock.connect(accounts[0]).powerOff()
      // validate event
      await expect(txPromise).to.emit(Mock, 'PowerOff')
      // validate state
      expect(await Mock.isOnline()).to.eq(false)
      expect(await Mock.isOffline()).to.eq(true)
      expect(await Mock.isShutdown()).to.eq(false)
      expect(await Mock.getStatus()).to.eq(1)
    })
  })

  describe('emergencyShutdown', function () {
    it('should fail if msg.sender is not admin', async function () {
      expect(await Mock.getPowerController()).to.eq(accounts[0].address)
      await expect(Mock.connect(accounts[1]).emergencyShutdown()).to.be.revertedWith('Ownable: caller is not the owner')
    })
    it('should succeed if in online state', async function () {
      await Mock.connect(accounts[0]).emergencyShutdown()
    })
    it('should succeed if in offline state', async function () {
      await Mock.connect(accounts[0]).powerOff()
      await Mock.connect(accounts[0]).emergencyShutdown()
    })
    it('should fail if in shutdown state', async function () {
      await Mock.connect(accounts[0]).emergencyShutdown()
      await expect(Mock.connect(accounts[0]).emergencyShutdown()).to.be.revertedWith('PowerSwitch: cannot shutdown')
    })
    it('should succeed and emit event', async function () {
      const txPromise = Mock.connect(accounts[0]).emergencyShutdown()
      // validate event
      await expect(txPromise).to.emit(Mock, 'EmergencyShutdown')
      // validate state
      expect(await Mock.isOnline()).to.eq(false)
      expect(await Mock.isOffline()).to.eq(false)
      expect(await Mock.isShutdown()).to.eq(true)
      expect(await Mock.getStatus()).to.eq(2)
    })
  })
})
