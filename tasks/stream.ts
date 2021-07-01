import { task } from 'hardhat/config'
import { formatEther } from 'ethers/lib/utils'

// example goerli: yarn hardhat deploy-stream --stream-version V2 --token-address 0xdb435816e41eada055750369bc2662efbd465d72 --owner 0x46848c650d6adb98151df53cb73f44e2dd784d92 --network goerli
// example mainnet: yarn hardhat deploy-stream --stream-version V2 --token-address 0x88acdd2a6425c3faae4bc9650fd7e27e0bebb7ab --owner 0x46848c650d6adb98151df53cb73f44e2dd784d92 --network mainnet
// Important: ensure addresses are lowercase

task('deploy-stream', 'deploy stream smart contract')
.addParam('streamVersion', 'the stream smart contract version')
.addParam('tokenAddress', 'the mist token')
.addParam('owner', 'the admin of the stream')
.setAction(
  async (args, { ethers, run, network }) => {
    console.log(network.name)
    await run('compile')
    const contractName = 'Stream'+args.streamVersion
    const signer = (await ethers.getSigners())[0]

    console.log('Signer')
    console.log('  at', signer.address)
    console.log('  ETH', formatEther(await signer.getBalance()))

    const factory = await ethers.getContractFactory(contractName, signer)
    const constructorArguments = [
      args.tokenAddress, // token address (lowercase)
      args.owner, // owner address (lowercase)
    ]
    const contract = await factory.deploy(...constructorArguments)
    console.log('Deploying', contractName)
    console.log('  to', contract.address)
    console.log('  in', contract.deployTransaction.hash)
    await contract.deployTransaction.wait()
    console.log('Constructor arguments')
    console.log(constructorArguments);
    await run('verify:verify', {
      address: contract.address,
      constructorArguments: constructorArguments,
    })
  },
)