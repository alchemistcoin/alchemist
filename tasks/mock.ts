import { parseEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'

task('deploy-mock-token', 'deploy mock token')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    // log config

    console.log('Network')
    console.log('  ', network.name)
    console.log('Task Args')
    console.log(args)

    // compile

    await run('compile')

    // get signer

    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at', signer.address)

    // deploy token

    const tokenArgs = [signer.address, parseEther('1000')]

    const token = await (await ethers.getContractFactory('MockERC20'))
      .connect(signer)
      .deploy(...tokenArgs)

    console.log('Deploying MockERC20')
    console.log('  to', token.address)
    console.log('  in', token.deployTransaction.hash)

    // verify source

    if (args.verify) {
      await token.deployTransaction.wait(5)

      await run('verify:verify', {
        address: token.address,
        constructorArguments: tokenArgs,
      })
    }
  })
