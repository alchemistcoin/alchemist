import IUniswapV2ERC20 from '@uniswap/v2-core/build/IUniswapV2ERC20.json'
import { expect } from 'chai'
import { constants, Wallet } from 'ethers'
import { formatEther, parseEther, parseUnits } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { deployContract, signPermission } from './utils'

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

task('unstake-claim-withdraw', 'Unstake lp tokens, claim reward, and withdraw')
  .addParam('crucible', 'Crucible vault contract')
  .addParam('aludel', 'Aludel reward contract')
  .addParam('recipient', 'Address to receive stake and reward')
  .addParam('amount', 'Amount of staking tokens with decimals')
  .addFlag('private', 'Use taichi network to avoid frontrunners')
  .setAction(async (args, { ethers, run, network }) => {
    // log config

    console.log('Network')
    console.log('  ', network.name)
    console.log('Task Args')
    console.log(args)

    // compile

    await run('compile')

    // get signer

    let signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at', signer.address)
    console.log('  ETH', formatEther(await signer.getBalance()))
    const signerWallet = Wallet.fromMnemonic(process.env.DEV_MNEMONIC || '')
    expect(signer.address).to.be.eq(signerWallet.address)

    // fetch contracts

    const aludel = await ethers.getContractAt('Aludel', args.aludel, signer)
    const stakingToken = await ethers.getContractAt(
      IUniswapV2ERC20.abi,
      (await aludel.getAludelData()).stakingToken,
      signer,
    )
    const crucible = await ethers.getContractAt(
      'Crucible',
      args.crucible,
      signer,
    )

    if (network.name === 'hardhat') {
      // unlock account and transfer nft
      const owner = await crucible.owner()
      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [owner],
      })
      const fakeSigner = ethers.provider.getSigner(owner)
      const nft = await ethers.getContractAt(
        'CrucibleFactory',
        await crucible.nft(),
        fakeSigner,
      )

      await nft.transferFrom(owner, signer.address, crucible.address)

      await network.provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [owner],
      })
    }

    // declare config

    const amount = parseUnits(args.amount, await stakingToken.decimals())
    const nonce = await crucible.getNonce()
    const recipient = args.recipient

    // validate balances

    expect(await stakingToken.balanceOf(crucible.address)).to.be.gte(amount)

    // craft permission

    console.log('Sign Unlock permission')

    const permission = await signPermission(
      'Unlock',
      crucible,
      signerWallet,
      aludel.address,
      stakingToken.address,
      amount,
      nonce,
    )

    console.log('Unstake and Claim')

    const unstakeTx = await aludel.unstakeAndClaim(
      crucible.address,
      recipient,
      amount,
      permission,
    )

    console.log('  in', unstakeTx.hash)

    console.log('Withdraw from crucible')

    const withdrawPoputatedTx = await crucible.populateTransaction.transferERC20(
      stakingToken.address,
      recipient,
      amount,
    )

    if (args.private) {
      const taichi = new ethers.providers.JsonRpcProvider(
        'https://api.taichi.network:10001/rpc/private',
        'mainnet',
      )
      signer = signer.connect(taichi)
    }

    const withdrawTx = await signer.sendTransaction(withdrawPoputatedTx)
    console.log('  in', withdrawTx.hash)
  })
