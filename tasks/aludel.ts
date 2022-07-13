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

    // CLI Example - Polygon

    // yarn hardhat create-aludel \
    //       --staking-token 0x0000000000000000000000000000000000000000 \
    //       --reward-token 0x0000000000000000000000000000000000000000 \
    //       --reward-amount 0 \
    //       --unlock-days 0 \
    //       --scaling-floor 1 \
    //       --scaling-ceiling 10 \
    //       --scaling-days 40 \
    //       --reward-pool-factory 0xf3D4b566ecEF776d44Aba803306480Ef634CB1Da \
    //       --power-switch-factory 0x1625b84D233dF4b131da7B49c2b540890aBA0E96 \
    //       --crucible-factory 0xE2dD7930d8cA478d9aA38Ae0F5483B8A3B331C40 \
    //       --owner 0x0000000000000000000000000000000000000000 \
    //       --network polygon \
    //       --verify
  
    // CLI Example - Mainnet

    // yarn hardhat create-aludel \
    //       --staking-token 0x0000000000000000000000000000000000000000 \
    //       --reward-token 0x0000000000000000000000000000000000000000 \
    //       --reward-amount 0 \
    //       --unlock-days 0 \
    //       --scaling-floor 1 \
    //       --scaling-ceiling 14 \
    //       --scaling-days 7 \
    //       --reward-pool-factory 0xF016fa84D5f3a252409a63b5cb89B555A0d27Ccf \
    //       --power-switch-factory 0x89d2D92eaCE71977dD0b159062f8ec90EA64fc24 \
    //       --crucible-factory 0x54e0395CFB4f39beF66DBCd5bD93Cca4E9273D56 \
    //       --owner 0x0000000000000000000000000000000000000000 \
    //       --network mainnet \
    //       --verify

    // log config

    console.log('Network')
    console.log('  ', network.name)
    console.log('Task Args')
    console.log(args)

    // compile

    await run('compile')

    // // get signer

    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at', signer.address)
    console.log('  balance', formatEther(await signer.getBalance()))

    // load contracts

    const rewardToken = await ethers.getContractAt(
      'IERC20Detailed',
      args.rewardToken,
      signer,
    )

    // validate balances

    console.log('Validate balances')

    let rewardAmount;
    // reward token balance check
    if (Number(args.rewardAmount) > 0) {
      rewardAmount = parseUnits(
        args.rewardAmount,
        await rewardToken.decimals(),
      )

      expect(await rewardToken.balanceOf(signer.address)).to.be.gte(rewardAmount)
    }

    // native token balance check
    expect(await signer.getBalance()).to.be.gte(parseEther('0.5'))

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

    if (Number(args.rewardAmount) > 0) {
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
    }

    // add crucible factory

    console.log('Register Crucible Factory')

    const registerTx = await aludel.registerVaultFactory(args.crucibleFactory)

    console.log('  in', registerTx.hash)

    // transfer ownership
    if (args.owner !== '', args.owner.toLowerCase() != signer.address.toLowerCase()) {
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
    }

    // verify source

    if (args.verify) {
      await aludel.deployTransaction.wait(5)

      await run('verify:verify', {
        address: aludel.address,
        constructorArguments: aludelArgs,
      })
    }
  })

task('unstake-and-claim', 'Unstake lp tokens and claim reward')
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

    const populatedTx = await aludel.populateTransaction.unstakeAndClaim(
      crucible.address,
      amount,
      permission,
    )

    if (args.private) {
      const gasPrice = await signer.getGasPrice()
      const gasLimit = await signer.estimateGas(populatedTx)
      const nonce = await signer.getTransactionCount()
      const signerWallet = Wallet.fromMnemonic(
        process.env.DEV_MNEMONIC || '',
      ).connect(ethers.provider)

      const signedTx = await signerWallet.signTransaction({
        ...populatedTx,
        gasPrice,
        gasLimit,
        nonce,
      })

      const taichi = new ethers.providers.JsonRpcProvider(
        'https://api.taichi.network:10001/rpc/private',
        'mainnet',
      )

      const unstakeTx = await taichi.sendTransaction(signedTx)
      console.log(`  in https://taichi.network/tx/${unstakeTx.hash}`)
    } else {
      const unstakeTx = await signer.sendTransaction(populatedTx)
      console.log('  in', unstakeTx.hash)
    }

    console.log('Withdraw from crucible')

    const withdrawTx = await crucible.transferERC20(
      stakingToken.address,
      recipient,
      amount,
    )

    console.log('  in', withdrawTx?.hash)
  })