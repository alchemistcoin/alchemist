import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'
import { create2Instance, createInstance, deployContract } from './utils'

describe('VaultFactory', function () {
  let accounts: SignerWithAddress[]
  let factory: Contract, template: Contract

  beforeEach(async function () {
    // prepare signers
    accounts = await ethers.getSigners()
    // deploy template
    template = await deployContract('UniversalVault')
    // deploy factory
    factory = await deployContract('VaultFactory', [template.address])
  })

  describe('getTemplate', function () {
    it('should succeed', async function () {
      expect(await factory.getTemplate()).to.be.eq(template.address)
    })
  })
  describe('create', function () {
    it('should succeed', async function () {
      await createInstance('UniversalVault', factory, accounts[0])
    })
    it('should successfully call owner', async function () {
      const vault = await createInstance('UniversalVault', factory, accounts[0])
      expect(await vault.owner()).to.eq(accounts[0].address)
    })
  })
  describe('create2', function () {
    it('should succeed', async function () {
      await create2Instance('UniversalVault', factory, accounts[0], ethers.utils.randomBytes(32))
    })
    it('should successfully call owner', async function () {
      const vault = await create2Instance('UniversalVault', factory, accounts[0], ethers.utils.randomBytes(32))
      expect(await vault.owner()).to.eq(accounts[0].address)
    })
  })
})
