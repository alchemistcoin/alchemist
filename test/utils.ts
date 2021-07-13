import { TypedDataField } from '@ethersproject/abstract-signer'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumberish, BytesLike, Contract, Signer, Wallet } from 'ethers'
import { ethers, network, upgrades } from 'hardhat'

export async function getTimestamp() {
  return (await ethers.provider.getBlock('latest')).timestamp
}

export async function increaseTime(seconds: number) {
  const time = await getTimestamp()
  // instead of using evm_increaseTime, we can pass in the timestamp
  // the next block should setup as the mining time
  const expectedEndTime = time + seconds - 1
  await network.provider.request({
    method: 'evm_mine',
    params: [expectedEndTime],
  })
  if (expectedEndTime !== (await getTimestamp())) {
    throw new Error('evm_mine failed')
  }
}

// Perc has to be a whole number
export async function invokeRebase(ampl: Contract, perc: number, orchestrator: Signer) {
  const PERC_DECIMALS = 2
  const s = await ampl.totalSupply.call()
  const ordinate = 10 ** PERC_DECIMALS
  const p_ = ethers.BigNumber.from(perc * ordinate).div(100)
  const s_ = s.mul(p_).div(ordinate)
  await ampl.connect(orchestrator).rebase(1, s_)
}

export async function deployContract(name: string, args: Array<any> = []) {
  const factory = await ethers.getContractFactory(name)
  const contract = await factory.deploy(...args)
  return contract.deployed()
}

export async function deployAmpl(admin: SignerWithAddress) {
  const factory = await ethers.getContractFactory('MockAmpl')
  const ampl = await upgrades.deployProxy(factory, [admin.address], {
    initializer: 'initialize(address)',
  })
  await ampl.connect(admin).setMonetaryPolicy(admin.address)
  const amplInitialSupply = await ampl.balanceOf(admin.address)
  return { ampl, amplInitialSupply }
}

export async function deployGeyser(args: Array<any>) {
  const factory = await ethers.getContractFactory('Geyser')
  return upgrades.deployProxy(factory, args, {
    unsafeAllowCustomTypes: true,
  })
}

export async function createInstance(instanceName: string, factory: Contract, signer: Signer, args: string = '0x') {
  // get contract class
  const instance = await ethers.getContractAt(
    instanceName,
    await factory.connect(signer).callStatic['create(bytes)'](args),
  )
  // deploy vault
  await factory.connect(signer)['create(bytes)'](args)
  // return contract class
  return instance
}

export async function create2Instance(
  instanceName: string,
  factory: Contract,
  signer: Signer,
  salt: BytesLike,
  args: string = '0x',
) {
  // get contract class
  const instance = await ethers.getContractAt(
    instanceName,
    await factory.connect(signer).callStatic['create2(bytes,bytes32)'](args, salt),
  )
  // deploy vault
  await factory.connect(signer)['create2(bytes,bytes32)'](args, salt)
  // return contract class
  return instance
}

export const signPermission = async (
  method: string,
  vault: Contract,
  owner: Wallet,
  delegateAddress: string,
  tokenAddress: string,
  amount: BigNumberish,
  vaultNonce?: BigNumberish,
  chainId?: BigNumberish,
) => {
  // get nonce
  vaultNonce = vaultNonce || (await vault.getNonce())
  // get chainId
  chainId = chainId || (await vault.provider.getNetwork()).chainId
  // craft permission
  const domain = {
    name: 'UniversalVault',
    version: '1.0.0',
    chainId,
    verifyingContract: vault.address,
  }
  const types = {} as Record<string, TypedDataField[]>
  types[method] = [
    { name: 'delegate', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ]
  const value = {
    delegate: delegateAddress,
    token: tokenAddress,
    amount: amount,
    nonce: vaultNonce,
  }
  // sign permission
  const signedPermission = await owner._signTypedData(domain, types, value)
  // return
  return signedPermission
}

export const transferNFT = async (nft: Contract, signer: Signer, owner: string, recipient: string, tokenId: string) => {
  return nft.connect(signer)['safeTransferFrom(address,address,uint256)'](owner, recipient, tokenId)
}

export const ERC1271_VALID_SIG = '0x1626ba7e'
export const ERC1271_INVALID_SIG = '0xffffffff'
export const ETHER = ethers.utils.parseEther('1')
