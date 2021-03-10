import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json'
import dayjs from 'dayjs'
import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'

task('status', 'Check Alchemist system status').setAction(
  async ({}, { ethers }) => {
    const alchemist = await ethers.getContractAt(
      'Alchemist',
      'alchemistcoin.eth',
    )
    console.log('Alchemist ⚗️')
    console.log('  at           ', alchemist.address)
    console.log('  admin        ', await alchemist.getAdmin())
    console.log('  recipient    ', await alchemist.getRecipient())
    console.log('  total supply ', formatEther(await alchemist.totalSupply()))
    console.log('  timelock     ', (await alchemist.getTimelock()).toNumber())
    const epochDuration = await alchemist.getEpochDuration()
    console.log('  epochDuration', epochDuration.toNumber())
    console.log(
      '  inflationBps ',
      (await alchemist.getInflationBps()).toNumber(),
    )
    const epochNumber = BigNumber.from(
      await alchemist.provider.getStorageAt(alchemist.address, 17),
    )
    console.log('  epoch        ', epochNumber.toNumber())
    const epochStart = BigNumber.from(
      await alchemist.provider.getStorageAt(alchemist.address, 18),
    )
    console.log(
      '  epochStart   ',
      epochStart.toNumber(),
      'at',
      dayjs.unix(epochStart.toNumber()).format(),
    )
    console.log(
      '  nextEpoch    ',
      epochStart.add(epochDuration).toNumber(),
      'at',
      dayjs.unix(epochStart.add(epochDuration).toNumber()).format(),
    )

    const tokenManager = await ethers.getContractAt(
      'TokenManager',
      await alchemist.getRecipient(),
    )
    console.log('TokenManager')
    console.log('  at           ', tokenManager.address)
    console.log('  owner        ', await tokenManager.owner())
    console.log(
      '  ⚗️            ',
      formatEther(await alchemist.balanceOf(tokenManager.address)),
    )
    console.log(
      '  ETH          ',
      formatEther(await tokenManager.provider.getBalance(tokenManager.address)),
    )

    const uniPair = await ethers.getContractAt(
      IUniswapV2Pair.abi,
      '0xcd6bcca48069f8588780dfa274960f15685aee0e',
    )
    const reserves = await uniPair.getReserves()
    const totalSupply = await alchemist.totalSupply()

    console.log('Uniswap Pair')
    console.log('  at           ', uniPair.address)
    console.log('  ⚗️            ', formatEther(reserves[0]))
    console.log('  ETH          ', formatEther(reserves[1]))
    console.log('  ETH/⚗️        ', reserves[1] / reserves[0])
    console.log('  ⚗️ supply %   ', (reserves[0] / totalSupply) * 100)
  },
)
