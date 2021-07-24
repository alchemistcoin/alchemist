import { formatEther, Logger } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { deployContract } from './utils'

task('deploy-milestone-manager').setAction(
  async (args, { ethers, run, network }) => {
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

    const milestoneManager = await deployContract(
      'MilestoneManager',
      await ethers.getContractFactory('MilestoneManager'),
      signer,
    )
  },
)

task('create-milestone')
  .addParam('manager')
  .addParam('token')
  .addParam('start')
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

    const milestoneManager = await ethers.getContractAt(
      'MilestoneManager',
      args.manager,
      signer,
    )

    // create milestone

    const createTx = await (
      await milestoneManager.createMilestone(args.token, args.start)
    ).wait()

    const milestone = await ethers.getContractAt(
      'MilestoneV1',
      createTx.events[0].args.instance,
      signer,
    )

    console.log('Milestone created')
    console.log(' to', milestone.address)
    console.log(' in', createTx.transactionHash)
  })

task('cliff-milestone')
  .addParam('manager')
  .addParam('milestone')
  .addFlag('success')
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

    const milestoneManager = await ethers.getContractAt(
      'MilestoneManager',
      args.manager,
      signer,
    )

    const milestone = await ethers.getContractAt(
      'MilestoneV1',
      args.milestone,
      signer,
    )

    // cliff milestone

    const cliffTx = await (
      await milestoneManager.cliff(milestone.address, args.success)
    ).wait()

    console.log('Milestone Cliffed')
    console.log(' in', cliffTx.transactionHash)
  })

task('allocate-milestone')
  .addParam('manager')
  .addParam('milestone')
  .addParam('builder')
  .addParam('cashAmount')
  .addParam('lockedAmount')
  .addParam('duration')
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

    const milestoneManager = await ethers.getContractAt(
      'MilestoneManager',
      args.milestoneManager,
      signer,
    )

    const milestone = await ethers.getContractAt(
      'MilestoneV1',
      args.milestone,
      signer,
    )

    // allocate milestone

    const input = [
      milestone.address,
      args.builder,
      args.cashAmount,
      args.lockedAmount,
      args.duration,
    ]
    const allocateTx = await (await milestone.allocate(input)).wait()

    console.log('Milestone Allocated')
    console.log(' in', allocateTx.transactionHash)
  })
