import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { hashMessage, keccak256 } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { deployContract } from '../utils'

describe('ERC1271', function () {
  let accounts: SignerWithAddress[]
  let MockERC1271: Contract
  const message = hashMessage('ERC1271 test message')
  let VALID_SIG: string
  const INVALID_SIG = '0x00000000'

  function toEthSignedMessageHash(messageHex: string) {
    const messageBuffer = Buffer.from(messageHex.substring(2), 'hex')
    const prefix = Buffer.from(`\u0019Ethereum Signed Message:\n${messageBuffer.length}`)
    return keccak256(Buffer.concat([prefix, messageBuffer]))
  }

  beforeEach(async function () {
    // prepare signers
    accounts = await ethers.getSigners()
    // deploy mock
    MockERC1271 = await deployContract('MockERC1271', [accounts[0].address])
    VALID_SIG = MockERC1271.interface.getSighash('isValidSignature(bytes32,bytes)')
  })

  describe('isValidSignature', function () {
    it('should return error value if signed by account other than owner', async function () {
      const sig = await accounts[1].signMessage(message)
      expect(await MockERC1271.isValidSignature(toEthSignedMessageHash(message), sig)).to.eq(INVALID_SIG)
    })

    it('should revert if signature has incorrect length', async function () {
      const sig = await accounts[0].signMessage(message)
      expect(MockERC1271.isValidSignature(toEthSignedMessageHash(message), sig.slice(0, 10))).to.be.revertedWith(
        'ECDSA: invalid signature length',
      )
    })

    it('should return success value if signed by owner', async function () {
      const sig = await accounts[0].signMessage(message)
      expect(await MockERC1271.isValidSignature(hashMessage(message), sig)).to.eq(VALID_SIG)
    })
  })
})
