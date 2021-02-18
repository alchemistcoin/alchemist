import { expect } from 'chai'
import { constants } from 'ethers'
import { formatEther, parseEther, parseUnits } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { deployContract } from './utils'

const DAY = 60 * 60 * 24

task('deploy-aludel-factories', 'Deploy Aludel factory contracts')
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

    const rewardPoolFactory = await deployContract(
      'RewardPoolFactory',
      await ethers.getContractFactory('RewardPoolFactory'),
      signer,
    )

    const powerSwitchFactory = await deployContract(
      'PowerSwitchFactory',
      await ethers.getContractFactory('PowerSwitchFactory'),
      signer,
    )

    // verify

    if (args.verify) {
      console.log('Verifying source on etherscan')

      await powerSwitchFactory.deployTransaction.wait(5)

      await run('verify:verify', {
        address: rewardPoolFactory.address,
      })

      await run('verify:verify', {
        address: powerSwitchFactory.address,
      })
    }
  })

task('create-aludel', 'Create an Aludel instance and deposit funds')
  .addParam('stakingToken', 'the staking token')
  .addParam('rewardToken', 'the reward token')
  .addParam('rewardAmount', 'the reward amount')
  .addParam('unlockDays', 'number of days to unlock reward')
  .addParam('scalingFloor', 'the scaling floor')
  .addParam('scalingCeiling', 'the scaling ceiling')
  .addParam('scalingDays', 'the scaling time in days')
  .addParam('rewardPoolFactory', 'RewardPoolFactory address')
  .addParam('powerSwitchFactory', 'PowerSwitchFactory address')
  .addParam('crucibleFactory', 'CrucibleFactory address')
  .addParam('owner', 'the admin of the system')
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

    // load contracts

    const rewardToken = await ethers.getContractAt(
      'IERC20Detailed',
      args.rewardToken,
      signer,
    )

    // validate balances

    console.log('Validate balances')

    const rewardAmount = parseUnits(
      args.rewardAmount,
      await rewardToken.decimals(),
    )

    expect(await rewardToken.balanceOf(signer.address)).to.be.gte(rewardAmount)
    expect(await signer.getBalance()).to.be.gte(parseEther('1'))

    // deploy instance

    const aludelArgs = [
      signer.address,
      args.rewardPoolFactory,
      args.powerSwitchFactory,
      args.stakingToken,
      args.rewardToken,
      [args.scalingFloor, args.scalingCeiling, args.scalingDays * DAY],
    ]

    console.log('Aludel constructor args')
    console.log(aludelArgs)

    const aludel = await deployContract(
      'Aludel',
      await ethers.getContractFactory('Aludel'),
      signer,
      aludelArgs,
    )

    // fund aludel

    console.log('Approve reward deposit')

    const approveTx = await rewardToken.approve(
      aludel.address,
      constants.MaxUint256,
    )
    await approveTx.wait()

    console.log('  in', approveTx.hash)

    console.log('Deposit reward')

    const depositTx = await aludel.fund(rewardAmount, args.unlockDays * DAY)

    console.log('  in', depositTx.hash)

    // add crucible factory

    console.log('Register Crucible Factory')

    const registerTx = await aludel.registerVaultFactory(args.crucibleFactory)

    console.log('  in', registerTx.hash)

    // transfer ownership

    const powerSwitch = await ethers.getContractAt(
      'PowerSwitch',
      await aludel.getPowerSwitch(),
      signer,
    )

    console.log('Transfer admin')

    const transferAdminTx = await aludel.transferOwnership(args.owner)

    console.log('  to', await aludel.owner())
    console.log('  in', transferAdminTx.hash)

    console.log('Transfer power controller')

    const transferPowerTx = await powerSwitch.transferOwnership(args.owner)

    console.log('  to', await powerSwitch.owner())
    console.log('  in', transferPowerTx.hash)

    // verify source

    if (args.verify) {
      await aludel.deployTransaction.wait(5)

      await run('verify:verify', {
        address: aludel.address,
        constructorArguments: aludelArgs,
      })
    }
  })
