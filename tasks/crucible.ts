import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { deployContract } from './utils'

task('deploy-crucible-factory', 'Deploy Crucible factory contracts')
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
    console.log('  ETH', formatEther(await signer.getBalance()))

    // deploy contracts

    const crucible = await deployContract(
      'Crucible',
      await ethers.getContractFactory('Crucible'),
      signer,
    )
    const crucibleFactory = await deployContract(
      'CrucibleFactory',
      await ethers.getContractFactory('CrucibleFactory'),
      signer,
      [crucible.address],
    )

    // lock template

    console.log('Locking template')

    await crucible.initializeLock()

    // verify source

    if (args.verify) {
      console.log('Verifying source on etherscan')

      await crucibleFactory.deployTransaction.wait(5)

      await run('verify:verify', {
        address: crucible.address,
      })
      await run('verify:verify', {
        address: crucibleFactory.address,
        constructorArguments: [crucible.address],
      })
    }
  })

task('mint-crucible', 'Mint a Crucible instance')
  .addParam('factory', 'the Crucible factory address')
  .addParam('owner', 'the owner of the Crucible')
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
    console.log('  ETH', formatEther(await signer.getBalance()))

    // load contracts

    const factory = await ethers.getContractAt(
      'VaultFactory',
      args.factory,
      signer,
    )

    // deploy instance

    const crucible = await ethers.getContractAt(
      'Crucible',
      await factory.callStatic['create()'](),
    )

    const tx = await factory['create()']()

    console.log('Deploying Crucible')
    console.log('  to', crucible.address)
    console.log('  in', tx.hash)

    // transfer ownership

    await tx.wait()

    const transferTx = await factory.transferFrom(
      signer.address,
      args.owner,
      crucible.address,
    )
    console.log('Transfer ownership')
    console.log('  to', args.owner)
    console.log('  in', transferTx.hash)
  })
