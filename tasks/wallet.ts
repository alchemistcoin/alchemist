import { Wallet } from 'ethers'
import { task } from 'hardhat/config'

task('generate', 'Generate random mnemonic')
  .addOptionalPositionalParam('token', 'token address')
  .setAction(async (args, { ethers }) => {
    const wallet = Wallet.createRandom()

    console.log('New wallet created')
    console.log('  address ', wallet.address)
    console.log('  mnemonic', wallet.mnemonic.phrase)
  })
