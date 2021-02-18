import IUniswapV2Factory from '@uniswap/v2-core/build/IUniswapV2Factory.json'
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json'

import { constants } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'

task('create-uni-pool', 'create a uniswap pool')
  .addPositionalParam('tokenA')
  .addPositionalParam('tokenB')
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

    const tokenA = await ethers.getContractAt(
      'IERC20Detailed',
      args.tokenA,
      signer,
    )
    const tokenB = await ethers.getContractAt(
      'IERC20Detailed',
      args.tokenB,
      signer,
    )
    const uniFactory = await ethers.getContractAt(
      IUniswapV2Factory.abi,
      '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      signer,
    )

    // deploy pair

    if (
      (await uniFactory.getPair(tokenA.address, tokenB.address)) ===
      constants.AddressZero
    ) {
      await (await uniFactory.createPair(tokenA.address, tokenB.address)).wait()
    }

    const pair = await ethers.getContractAt(
      IUniswapV2Pair.abi,
      await uniFactory.getPair(tokenA.address, tokenB.address),
      signer,
    )

    console.log('Deployed UniswapPair')
    console.log('  at', pair.address)
  })
