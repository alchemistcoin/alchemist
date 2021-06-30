import { task } from 'hardhat/config'
import { formatEther } from 'ethers/lib/utils'

// example goerli: yarn hardhat deploy-stream --stream-version v1 --token-address 0xdb435816e41eada055750369bc2662efbd465d72 --owner 0x46848C650d6aDb98151DF53CB73F44E2Dd784D92 --network goerli

task('deploy-stream', 'deploy stream smart contract')
.addParam('streamVersion', 'the mist token')
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
    console.log('Constructor arguements')
    console.log(constructorArguments);
    await run('verify:verify', {
      address: contract.address,
      constructorArguments: constructorArguments,
    })
  },
)