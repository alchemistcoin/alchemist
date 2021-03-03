import { Wallet } from 'ethers'
import {
  formatEther,
  formatUnits,
  getAddress,
  parseEther,
  parseUnits,
} from 'ethers/lib/utils'
import { task } from 'hardhat/config'

task('generate', 'Generate random mnemonic')
  .addOptionalPositionalParam('token', 'token address')
  .setAction(async (args, { ethers }) => {
    const wallet = Wallet.createRandom()

    console.log('New wallet created')
    console.log('  address: ', wallet.address)
    console.log('  mnemonic:', wallet.mnemonic.phrase)
  })

task('balance', 'Check wallet balance')
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

task('recover', 'Drain wallet of tokens or eth')
  .addParam('to', 'recipient address')
  .addOptionalParam('token', 'token address')
  .setAction(async (args, { ethers, run }) => {
    // compile

    await run('compile')

    // get signer
    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at  ', signer.address)
    console.log('  ETH ', formatEther(await signer.getBalance()))

    // log token balance

    // const to = getAddress(args.to)
    const to = args.to

    if (args.token) {
      const token = await ethers.getContractAt(
        'IERC20Detailed',
        args.token,
        signer,
      )
      const balance = await token.balanceOf(signer.address)
      const tx = await token.transfer(to, balance)

      console.log('Recover')
      console.log(
        `  ${await token.symbol()} `,
        formatUnits(balance, await token.decimals()),
      )
      console.log('  in', tx.hash)
    } else {
      const gasPrice = await signer.getGasPrice()
      const balance = await signer.getBalance()
      const value = balance.sub(gasPrice.mul('21000'))

      console.log('Recover')
      console.log('  ETH', formatEther(value))

      const tx = await signer.sendTransaction({
        to,
        value,
        gasPrice,
      })
      console.log('  in', tx.hash)
    }
  })

task('transfer-eth', 'Transfer eth amount')
  .addParam('to', 'recipient address')
  .addParam('value', 'amount of ETH to transfer')
  .setAction(async (args, { ethers, run }) => {
    // compile

    await run('compile')

    // get signer
    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at  ', signer.address)
    console.log('  ETH ', formatEther(await signer.getBalance()))

    // prep args

    const value = parseEther(args.value)
    const to = getAddress(args.to)

    // transfer

    console.log('Transfer ETH')
    console.log('  to   ', to)
    console.log('  value', formatEther(value))

    const tx = await signer.sendTransaction({ to, value })

    console.log('  in', tx.hash)
  })

task('transfer-erc20', 'Transfer erc20 amount')
  .addParam('token', 'erc20 token address')
  .addParam('to', 'recipient address')
  .addParam('value', 'amount of tokens to transfer')
  .setAction(async (args, { ethers, run, network }) => {
    // compile

    await run('compile')

    // get signer
    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at  ', signer.address)
    console.log('  ETH ', formatEther(await signer.getBalance()))

    // load contracts

    const token = await ethers.getContractAt(
      'IERC20Detailed',
      args.token,
      signer,
    )

    const symbol = await token.symbol()
    const decimals = await token.decimals()
    const balance = await token.balanceOf(signer.address)

    console.log(`  ${symbol}`, formatUnits(balance, decimals))

    // prep args

    const value = parseUnits(args.value, decimals)
    const to = getAddress(args.to)

    // transfer tokens

    console.log('Transfer', symbol)
    console.log('  to   ', to)
    console.log('  value', args.value)

    const tx = await token.transfer(to, value)

    console.log('  in', tx.hash)
  })

task('transfer-nft', 'Transfer NFT')
  .addParam('nft', 'erc721 nft address')
  .addParam('to', 'recipient address')
  .addParam('tokenId', 'tokenId to transfer')
  .setAction(async (args, { ethers, run }) => {
    // compile

    await run('compile')

    // get signer
    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at  ', signer.address)
    console.log('  ETH ', formatEther(await signer.getBalance()))

    // load contracts

    const nft = await ethers.getContractAt('IERC721Metadata', args.nft, signer)

    const symbol = await nft.symbol()
    const balance = await nft.balanceOf(signer.address)

    console.log(`  ${symbol}`, balance.toString())

    // prep args

    // const to = getAddress(args.to)
    const to = args.to

    // transfer nft

    console.log('Transfer', symbol)
    console.log('  to     ', to)
    console.log('  tokenId', args.tokenId.toString())

    const tx = await nft['safeTransferFrom(address,address,uint256)'](
      signer.address,
      to,
      args.tokenId,
    )

    console.log('  in', tx.hash)
  })
