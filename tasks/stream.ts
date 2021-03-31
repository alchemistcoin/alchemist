import { task } from 'hardhat/config'

task('deploy-stream', 'deploy stream smart contract').setAction(
  async (args, { ethers, run }) => {
    await run('compile')
    const contractName = 'StreamV1'
    const signer = (await ethers.getSigners())[0]
    const factory = await ethers.getContractFactory(contractName, signer)
    const constructorArguments = [
      '0x88acdd2a6425c3faae4bc9650fd7e27e0bebb7ab',
      '0x777B0884f97Fd361c55e472530272Be61cEb87c8',
    ]
    const contract = await factory.deploy(...constructorArguments)
    console.log('Deploying', contractName)
    console.log('  to', contract.address)
    console.log('  in', contract.deployTransaction.hash)
    await contract.deployTransaction.wait()
    await run('verify', {
      address: contract.address,
      constructorArguments: constructorArguments,
    })
  },
)
