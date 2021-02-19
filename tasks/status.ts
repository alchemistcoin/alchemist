import dayjs from 'dayjs'
import { BigNumber } from 'ethers'
import { formatEther, formatUnits } from 'ethers/lib/utils'
import { task } from 'hardhat/config'

task('status', 'Check Alchemist system status').setAction(
  async ({}, { ethers }) => {
    // get signer

    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at           ', signer.address)
    console.log('  ETH          ', formatEther(await signer.getBalance()))

    // fetch contracts

    const alchemist = await ethers.getContractAt(
      'Alchemist',
      'alchemistcoin.eth',
      signer,
    )
    console.log('Alchemist ⚗️')
    console.log('  at           ', alchemist.address)
    console.log('  admin        ', await alchemist.getAdmin())
    console.log('  recipient    ', await alchemist.getRecipient())
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
      signer,
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
  },
)

task('balance', 'Check signer balance')
  .addOptionalPositionalParam('token', 'token address')
  .setAction(async (args, { ethers, run }) => {
    // compile

    await run('compile')

    // get signer
    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at  ', signer.address)
    console.log('  ETH ', formatEther(await signer.getBalance()))

    // log token balance

    if (args.token) {
      const token = await ethers.getContractAt(
        'IERC20Detailed',
        args.token,
        signer,
      )
      console.log(
        `  ${await token.symbol()} `,
        formatUnits(
          await token.balanceOf(signer.address),
          await token.decimals(),
        ),
      )
    }
  })
