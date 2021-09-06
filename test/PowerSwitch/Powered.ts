import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'
import { deployContract } from '../utils'

describe('Powered', function () {
  let accounts: SignerWithAddress[]
  let PowerSwitch: Contract
  let Mock: Contract

  beforeEach(async function () {
    // prepare signers
    accounts = await ethers.getSigners()
    // deploy mock
    PowerSwitch = await deployContract('PowerSwitch', [accounts[0].address])
    Mock = await deployContract('MockPowered', [PowerSwitch.address])
  })

  describe('getPowerSwitch', function () {
    it('should succeed', async function () {
      expect(await Mock.getPowerSwitch()).to.eq(PowerSwitch.address)
    })
  })

  describe('getPowerController', function () {
    it('should succeed', async function () {
      expect(await Mock.getPowerController()).to.eq(accounts[0].address)
    })
  })

  describe('onlyOnline', function () {
    it('should succeed if online', async function () {
      expect(await Mock.isOnline()).to.eq(true)
      await Mock.onlyOnlineCall()
    })
    it('should fail if offline', async function () {
      await PowerSwitch.connect(accounts[0]).powerOff()
      expect(await Mock.isOffline()).to.eq(true)
      await expect(Mock.onlyOnlineCall()).to.be.revertedWith('Powered: is not online')
    })
    it('should fail if shutdown', async function () {
      await PowerSwitch.connect(accounts[0]).emergencyShutdown()
      expect(await Mock.isShutdown()).to.eq(true)
      await expect(Mock.onlyOnlineCall()).to.be.revertedWith('Powered: is not online')
    })
  })

  describe('onlyOffline', function () {
    it('should fail if online', async function () {
      expect(await Mock.isOnline()).to.eq(true)
      await expect(Mock.onlyOfflineCall()).to.be.revertedWith('Powered: is not offline')
    })
    it('should succeed if offline', async function () {
      await PowerSwitch.connect(accounts[0]).powerOff()
      expect(await Mock.isOffline()).to.eq(true)
      await Mock.onlyOfflineCall()
    })
    it('should fail if shutdown', async function () {
      await PowerSwitch.connect(accounts[0]).emergencyShutdown()
      expect(await Mock.isShutdown()).to.eq(true)
      await expect(Mock.onlyOfflineCall()).to.be.revertedWith('Powered: is not offline')
    })
  })

  describe('notShutdown', function () {
    it('should succeed if online', async function () {
      expect(await Mock.isOnline()).to.eq(true)
      await Mock.notShutdownCall()
    })
    it('should succeed if offline', async function () {
      await PowerSwitch.connect(accounts[0]).powerOff()
      expect(await Mock.isOffline()).to.eq(true)
      await Mock.notShutdownCall()
    })
    it('should fail if shutdown', async function () {
      await PowerSwitch.connect(accounts[0]).emergencyShutdown()
      expect(await Mock.isShutdown()).to.eq(true)
      await expect(Mock.notShutdownCall()).to.be.revertedWith('Powered: is shutdown')
    })
  })

  describe('onlyShutdown', function () {
    it('should fail if online', async function () {
      expect(await Mock.isOnline()).to.eq(true)
      await expect(Mock.onlyShutdownCall()).to.be.revertedWith('Powered: is not shutdown')
    })
    it('should fail if offline', async function () {
      await PowerSwitch.connect(accounts[0]).powerOff()
      expect(await Mock.isOffline()).to.eq(true)
      await expect(Mock.onlyShutdownCall()).to.be.revertedWith('Powered: is not shutdown')
    })
    it('should succeed if shutdown', async function () {
      await PowerSwitch.connect(accounts[0]).emergencyShutdown()
      expect(await Mock.isShutdown()).to.eq(true)
      await Mock.onlyShutdownCall()
    })
  })
})
