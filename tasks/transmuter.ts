import IUniswapV2ERC20 from '@uniswap/v2-core/build/IUniswapV2ERC20.json'
import { expect } from 'chai'
import { Wallet } from 'ethers'
import { formatEther, parseUnits, randomBytes } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { deployContract, signPermission, signPermitEIP2612 } from './utils'

task('deploy-transmuter-v1', 'Deploy TransmuterV1 contract')
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

    // deploy contract

    const transmuter = await deployContract(
      'TransmuterV1',
      await ethers.getContractFactory('TransmuterV1'),
      signer,
    )

    // verify source

    if (args.verify) {
      console.log('Verifying source on etherscan')

      await transmuter.deployTransaction.wait(5)

      await run('verify:verify', {
        address: transmuter.address,
      })
    }
  })

task('mint-and-lock', 'Mint Crucible and lock in Aludel')
  .addParam('aludel', 'Aludel reward contract')
  .addParam('crucibleFactory', 'Crucible factory contract')
  .addParam('transmuter', 'TransmuterV1 contract')
  .addParam('amount', 'Amount of staking tokens with decimals')
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
    const signerWallet = Wallet.fromMnemonic(process.env.DEV_MNEMONIC || '')
    expect(signer.address).to.be.eq(signerWallet.address)

    // fetch contracts

    const aludel = await ethers.getContractAt('Aludel', args.aludel, signer)
    const stakingToken = await ethers.getContractAt(
      IUniswapV2ERC20.abi,
      (await aludel.getAludelData()).stakingToken,
      signer,
    )
    const crucibleFactory = await ethers.getContractAt(
      'CrucibleFactory',
      args.crucibleFactory,
      signer,
    )
    const transmuter = await ethers.getContractAt(
      'TransmuterV1',
      args.transmuter,
      signer,
    )

    // declare config

    const amount = parseUnits(args.amount, await stakingToken.decimals())
    const salt = randomBytes(32)
    const deadline =
      (await ethers.provider.getBlock('latest')).timestamp + 60 * 60 * 24

    // validate balances
    expect(await stakingToken.balanceOf(signer.address)).to.be.gte(amount)

    // craft permission

    const crucible = await ethers.getContractAt(
      'Crucible',
      await transmuter.predictDeterministicAddress(
        await crucibleFactory.getTemplate(),
        salt,
        crucibleFactory.address,
      ),
      signer,
    )

    console.log('Sign Permit')

    const permit = await signPermitEIP2612(
      signerWallet,
      stakingToken,
      transmuter.address,
      amount,
      deadline,
    )

    console.log('Sign Lock')

    const permission = await signPermission(
      'Lock',
      crucible,
      signerWallet,
      aludel.address,
      stakingToken.address,
      amount,
      0,
    )

    console.log('Mint, Deposit, Stake')

    const tx = await transmuter.mintCruciblePermitAndStake(
      aludel.address,
      crucibleFactory.address,
      signer.address,
      salt,
      permit,
      permission,
    )
    console.log('  in', tx.hash)
  })
