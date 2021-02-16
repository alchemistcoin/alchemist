import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { parseEther, parseUnits, solidityKeccak256 } from 'ethers/lib/utils'
import { task } from 'hardhat/config'

const DAY = 60 * 60 * 24

task('deploy', 'deploy token contracts')
  .addParam('supply', 'initial supply')
  .addParam('inflationBps', 'per epoch inflation basis points')
  .addParam('epochDuration', 'epoch duration in days')
  .addParam('timelock', 'timelock duration in days')
  .addParam('admin', 'token admin address')
  .addParam('epochStart', 'epoch start timestamp')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(
    async (
      {
        supply,
        inflationBps,
        epochDuration,
        timelock,
        epochStart,
        admin,
        verify,
      },
      { ethers, run },
    ) => {
      // compile

      await run('compile')

      // get signer

      const signer = (await ethers.getSigners())[0]
      console.log('Signer')
      console.log('  at', signer.address)

      // deploy contracts

      const tokenManager = await (
        await ethers.getContractFactory('TokenManager', signer)
      ).deploy({ gasPrice: parseUnits('120', 'gwei') })

      console.log('Deploying TokenManager')
      console.log('  to', tokenManager.address)
      console.log('  in', tokenManager.deployTransaction.hash)

      await tokenManager.deployTransaction.wait(2)

      const tokenArgs = [
        admin,
        tokenManager.address,
        inflationBps,
        BigNumber.from(epochDuration).mul(DAY),
        BigNumber.from(timelock).mul(DAY),
        parseEther(supply),
        epochStart,
      ]

      const alchemist = await (
        await ethers.getContractFactory('Alchemist', signer)
      ).deploy(...tokenArgs, { gasPrice: parseUnits('120', 'gwei') })

      console.log('Deploying Alchemist')
      console.log('  to', alchemist.address)
      console.log('  in', alchemist.deployTransaction.hash)

      await alchemist.deployTransaction.wait(2)

      // transfer ownership

      await tokenManager.transferOwnership(admin)

      // post deployment checks

      console.log('Validating deployment')

      expect(await alchemist.balanceOf(tokenManager.address)).to.be.eq(
        parseEther(supply),
      )
      expect(await alchemist.getAdmin()).to.be.eq(admin)
      expect(await alchemist.RECIPIENT_CONFIG_ID()).to.be.eq(
        solidityKeccak256(['string'], ['Recipient']),
      )
      expect(await alchemist.RECIPIENT_CONFIG_ID()).to.be.eq(
        await alchemist.calculateConfigID('Recipient'),
      )

      // verify source

      if (verify) {
        console.log('Verifying source on etherscan')

        await alchemist.deployTransaction.wait(5)

        await run('verify:verify', {
          address: tokenManager.address,
        })
        await run('verify:verify', {
          address: alchemist.address,
          constructorArguments: tokenArgs,
        })
      }
    },
  )
