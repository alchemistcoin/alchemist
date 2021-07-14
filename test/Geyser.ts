import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, BigNumberish, Contract, Wallet } from 'ethers'
import { ethers, network } from 'hardhat'
import {
  createInstance,
  deployAmpl,
  deployContract,
  deployAludel,
  getTimestamp,
  increaseTime,
  invokeRebase,
  signPermission,
} from './utils'

/* 

  Dev note: This test file suffers from indeterminancy based on timestamp manipulation.

  If you are encountering tests which fail unexpectedly, make sure increaseTime() is 
  correctly setting the timestamp of the next block.

  Issue is being tracked here: https://github.com/nomiclabs/hardhat/issues/1079

*/

/*

  Note: the implementation of increaseTime() was changed to only use `evm_mine` with the
  timestamp passed as a parameter, instead of using a combination of `evm_increaseTime` and `evm_mine`

  This implementation does not seem to run into the same problem as it previously did.
  As a result, the indeterminancy issue is fixed

*/

describe('Aludel', function () {
  let accounts: SignerWithAddress[], admin: SignerWithAddress
  let user: Wallet

  let powerSwitchFactory: Contract,
    rewardPoolFactory: Contract,
    vaultTemplate: Contract,
    vaultFactory: Contract,
    stakingToken: Contract,
    rewardToken: Contract,
    bonusToken: Contract

  const mockTokenSupply = ethers.utils.parseEther('1000')
  const BASE_SHARES_PER_WEI = 1000000
  const DAY = 24 * 3600
  const YEAR = 365 * DAY
  const rewardScaling = { floor: 33, ceiling: 100, time: 60 * DAY }

  let amplInitialSupply: BigNumber

  const stake = async (
    user: Wallet,
    geyser: Contract,
    vault: Contract,
    stakingToken: Contract,
    amount: BigNumberish,
    vaultNonce?: BigNumberish,
  ) => {
    // sign permission
    const signedPermission = await signPermission(
      'Lock',
      vault,
      user,
      geyser.address,
      stakingToken.address,
      amount,
      vaultNonce,
    )
    // stake on geyser
    return geyser.stake(vault.address, amount, signedPermission)
  }

  const unstakeAndClaim = async (
    user: Wallet,
    geyser: Contract,
    vault: Contract,
    stakingToken: Contract,
    amount: BigNumberish,
    vaultNonce?: BigNumberish,
  ) => {
    // sign permission
    const signedPermission = await signPermission(
      'Unlock',
      vault,
      user,
      geyser.address,
      stakingToken.address,
      amount,
      vaultNonce,
    )
    // unstake on geyser
    return geyser.unstakeAndClaim(vault.address, amount, signedPermission)
  }

  function calculateExpectedReward(
    stakeAmount: BigNumber,
    stakeDuration: BigNumberish,
    rewardAvailable: BigNumber,
    otherStakeUnits: BigNumberish,
  ) {
    const stakeUnits = stakeAmount.mul(stakeDuration)
    const baseReward = rewardAvailable.mul(stakeUnits).div(stakeUnits.add(otherStakeUnits))
    const minReward = baseReward.mul(rewardScaling.floor).div(100)
    const bonusReward = baseReward
      .mul(rewardScaling.ceiling - rewardScaling.floor)
      .mul(stakeDuration)
      .div(rewardScaling.time)
      .div(100)
    return stakeDuration >= rewardScaling.time ? baseReward : minReward.add(bonusReward)
  }

  before(async function () {
    // prepare signers
    accounts = await ethers.getSigners()
    admin = accounts[1]
    user = Wallet.createRandom().connect(ethers.provider)
    await accounts[2].sendTransaction({
      to: user.address,
      value: (await accounts[2].getBalance()).mul(9).div(10),
    })
  })

  beforeEach(async function () {
    // deploy dependencies
    powerSwitchFactory = await deployContract('PowerSwitchFactory')
    rewardPoolFactory = await deployContract('RewardPoolFactory')
    vaultTemplate = await deployContract('Crucible')
    vaultFactory = await deployContract('CrucibleFactory', [vaultTemplate.address])

    // deploy mock tokens
    stakingToken = await deployContract('MockERC20', [admin.address, mockTokenSupply])
    ;({ ampl: rewardToken, amplInitialSupply } = await deployAmpl(admin))
    bonusToken = await deployContract('MockERC20', [admin.address, mockTokenSupply])
  })

  describe('initialize', function () {
    describe('when rewardScaling.floor > rewardScaling.ceiling', function () {
      it('should fail', async function () {
        const args = [
          admin.address,
          rewardPoolFactory.address,
          powerSwitchFactory.address,
          stakingToken.address,
          rewardToken.address,
          [rewardScaling.ceiling + 1, rewardScaling.ceiling, rewardScaling.time],
        ]
        await expect(deployAludel(args)).to.be.reverted
      })
    })
    describe('when rewardScalingTime = 0', function () {
      it('should fail', async function () {
        const args = [
          admin.address,
          rewardPoolFactory.address,
          powerSwitchFactory.address,
          stakingToken.address,
          rewardToken.address,
          [rewardScaling.floor, rewardScaling.ceiling, 0],
        ]
        await expect(deployAludel(args)).to.be.reverted
      })
    })
    describe('when parameters are valid', function () {
      it('should set contract variables', async function () {
        const args = [
          admin.address,
          rewardPoolFactory.address,
          powerSwitchFactory.address,
          stakingToken.address,
          rewardToken.address,
          [rewardScaling.floor, rewardScaling.ceiling, rewardScaling.time],
        ]
        const geyser = await deployAludel(args)

        const data = await geyser.getAludelData()

        expect(data.stakingToken).to.eq(stakingToken.address)
        expect(data.rewardToken).to.eq(rewardToken.address)
        expect(data.rewardPool).to.not.eq(ethers.constants.AddressZero)
        expect(data.rewardScaling.floor).to.eq(33)
        expect(data.rewardScaling.ceiling).to.eq(100)
        expect(data.rewardSharesOutstanding).to.eq(0)
        expect(data.totalStake).to.eq(0)
        expect(data.totalStakeUnits).to.eq(0)
        expect(data.lastUpdate).to.eq(0)
        expect(data.rewardSchedules).to.deep.eq([])
        expect(await geyser.getBonusTokenSetLength()).to.eq(0)
        expect(await geyser.owner()).to.eq(admin.address)
        expect(await geyser.getPowerSwitch()).to.not.eq(ethers.constants.AddressZero)
        expect(await geyser.getPowerController()).to.eq(admin.address)
        expect(await geyser.isOnline()).to.eq(true)
        expect(await geyser.isOffline()).to.eq(false)
        expect(await geyser.isShutdown()).to.eq(false)
      })
    })
  })

  describe('admin functions', function () {
    let geyser: Contract, powerSwitch: Contract, rewardPool: Contract
    beforeEach(async function () {
      const args = [
        admin.address,
        rewardPoolFactory.address,
        powerSwitchFactory.address,
        stakingToken.address,
        rewardToken.address,
        [rewardScaling.floor, rewardScaling.ceiling, rewardScaling.time],
      ]
      geyser = await deployAludel(args)
      powerSwitch = await ethers.getContractAt('PowerSwitch', await geyser.getPowerSwitch())
      rewardPool = await ethers.getContractAt('RewardPool', (await geyser.getAludelData()).rewardPool)
    })
    describe('fundAludel', function () {
      describe('with insufficient approval', function () {
        it('should fail', async function () {
          await expect(geyser.connect(admin).fund(amplInitialSupply, YEAR)).to.be.reverted
        })
      })
      describe('with duration of zero', function () {
        it('should fail', async function () {
          await rewardToken.connect(admin).approve(geyser.address, amplInitialSupply)
          await expect(geyser.connect(admin).fund(amplInitialSupply, 0)).to.be.revertedWith(
            'Aludel: invalid duration',
          )
        })
      })
      describe('as user', function () {
        it('should fail', async function () {
          await rewardToken.connect(admin).transfer(user.address, amplInitialSupply)
          await rewardToken.connect(user).approve(geyser.address, amplInitialSupply)
          await expect(geyser.connect(user).fund(amplInitialSupply, YEAR)).to.be.revertedWith(
            'Ownable: caller is not the owner',
          )
        })
      })
      describe('when offline', function () {
        it('should fail', async function () {
          await rewardToken.connect(admin).approve(geyser.address, amplInitialSupply)
          await powerSwitch.connect(admin).powerOff()
          await expect(geyser.connect(admin).fund(amplInitialSupply, YEAR)).to.be.revertedWith(
            'Powered: is not online',
          )
        })
      })
      describe('when shutdown', function () {
        it('should fail', async function () {
          await rewardToken.connect(admin).approve(geyser.address, amplInitialSupply)
          await powerSwitch.connect(admin).emergencyShutdown()
          await expect(geyser.connect(admin).fund(amplInitialSupply, YEAR)).to.be.revertedWith(
            'Powered: is not online',
          )
        })
      })
      describe('when online', function () {
        beforeEach(async function () {
          await rewardToken.connect(admin).approve(geyser.address, amplInitialSupply)
        })
        describe('at first funding', function () {
          it('should succeed', async function () {
            await geyser.connect(admin).fund(amplInitialSupply, YEAR)
          })
          it('should update state correctly', async function () {
            await geyser.connect(admin).fund(amplInitialSupply, YEAR)

            const data = await geyser.getAludelData()

            expect(data.rewardSharesOutstanding).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI))
            expect(data.rewardSchedules.length).to.eq(1)
            expect(data.rewardSchedules[0].duration).to.eq(YEAR)
            expect(data.rewardSchedules[0].start).to.eq(await getTimestamp())
            expect(data.rewardSchedules[0].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI))
          })
          it('should emit event', async function () {
            await expect(geyser.connect(admin).fund(amplInitialSupply, YEAR))
              .to.emit(geyser, 'AludelFunded')
              .withArgs(amplInitialSupply, YEAR)
          })
          it('should transfer tokens', async function () {
            await expect(geyser.connect(admin).fund(amplInitialSupply, YEAR))
              .to.emit(rewardToken, 'Transfer')
              .withArgs(admin.address, rewardPool.address, amplInitialSupply)
          })
        })
        describe('at second funding', function () {
          beforeEach(async function () {
            await geyser.connect(admin).fund(amplInitialSupply.div(2), YEAR)
          })
          describe('with no rebase', function () {
            it('should succeed', async function () {
              await geyser.connect(admin).fund(amplInitialSupply.div(2), YEAR)
            })
            it('should update state correctly', async function () {
              await geyser.connect(admin).fund(amplInitialSupply.div(2), YEAR)

              const data = await geyser.getAludelData()

              expect(data.rewardSharesOutstanding).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI))
              expect(data.rewardSchedules.length).to.eq(2)
              expect(data.rewardSchedules[0].duration).to.eq(YEAR)
              expect(data.rewardSchedules[0].start).to.eq((await getTimestamp()) - 1)
              expect(data.rewardSchedules[0].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
              expect(data.rewardSchedules[1].duration).to.eq(YEAR)
              expect(data.rewardSchedules[1].start).to.eq(await getTimestamp())
              expect(data.rewardSchedules[1].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
            })
            it('should emit event', async function () {
              await expect(geyser.connect(admin).fund(amplInitialSupply.div(2), YEAR))
                .to.emit(geyser, 'AludelFunded')
                .withArgs(amplInitialSupply.div(2), YEAR)
            })
            it('should transfer tokens', async function () {
              await expect(geyser.connect(admin).fund(amplInitialSupply.div(2), YEAR))
                .to.emit(rewardToken, 'Transfer')
                .withArgs(admin.address, rewardPool.address, amplInitialSupply.div(2))
            })
          })
          describe('with positive rebase of 200%', function () {
            beforeEach(async function () {
              // rebase of 100 doubles the inital supply
              await invokeRebase(rewardToken, 100, admin)
              await rewardToken.connect(admin).approve(geyser.address, amplInitialSupply)
            })
            it('should succeed', async function () {
              await geyser.connect(admin).fund(amplInitialSupply, YEAR)
            })
            it('should update state correctly', async function () {
              await geyser.connect(admin).fund(amplInitialSupply, YEAR)

              const data = await geyser.getAludelData()

              expect(data.rewardSharesOutstanding).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI))
              expect(data.rewardSchedules.length).to.eq(2)
              expect(data.rewardSchedules[0].duration).to.eq(YEAR)
              expect(data.rewardSchedules[0].start).to.eq((await getTimestamp()) - 3)
              expect(data.rewardSchedules[0].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
              expect(data.rewardSchedules[1].duration).to.eq(YEAR)
              expect(data.rewardSchedules[1].start).to.eq(await getTimestamp())
              expect(data.rewardSchedules[1].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
            })
            it('should emit event', async function () {
              await expect(geyser.connect(admin).fund(amplInitialSupply, YEAR))
                .to.emit(geyser, 'AludelFunded')
                .withArgs(amplInitialSupply, YEAR)
            })
            it('should transfer tokens', async function () {
              await expect(geyser.connect(admin).fund(amplInitialSupply, YEAR))
                .to.emit(rewardToken, 'Transfer')
                .withArgs(admin.address, rewardPool.address, amplInitialSupply)
            })
          })
          describe('with negative rebase of 50%', function () {
            beforeEach(async function () {
              // rebase of -50 halves the inital supply
              await invokeRebase(rewardToken, -50, admin)
            })
            it('should succeed', async function () {
              await geyser.connect(admin).fund(amplInitialSupply.div(4), YEAR)
            })
            it('should update state correctly', async function () {
              await geyser.connect(admin).fund(amplInitialSupply.div(4), YEAR)

              const data = await geyser.getAludelData()

              expect(data.rewardSharesOutstanding).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI))
              expect(data.rewardSchedules.length).to.eq(2)
              expect(data.rewardSchedules[0].duration).to.eq(YEAR)
              expect(data.rewardSchedules[0].start).to.eq((await getTimestamp()) - 2)
              expect(data.rewardSchedules[0].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
              expect(data.rewardSchedules[1].duration).to.eq(YEAR)
              expect(data.rewardSchedules[1].start).to.eq(await getTimestamp())
              expect(data.rewardSchedules[1].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
            })
            it('should emit event', async function () {
              await expect(geyser.connect(admin).fund(amplInitialSupply.div(4), YEAR))
                .to.emit(geyser, 'AludelFunded')
                .withArgs(amplInitialSupply.div(4), YEAR)
            })
            it('should transfer tokens', async function () {
              await expect(geyser.connect(admin).fund(amplInitialSupply.div(4), YEAR))
                .to.emit(rewardToken, 'Transfer')
                .withArgs(admin.address, rewardPool.address, amplInitialSupply.div(4))
            })
          })
        })
        describe('after unstake', function () {
          const stakeAmount = ethers.utils.parseEther('100')

          let vault: Contract
          beforeEach(async function () {
            await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
            vault = await createInstance('Crucible', vaultFactory, user)

            await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

            await stake(user, geyser, vault, stakingToken, stakeAmount)

            await increaseTime(rewardScaling.time)

            await rewardToken.connect(admin).approve(geyser.address, amplInitialSupply)
            await geyser.connect(admin).fund(amplInitialSupply.div(2), rewardScaling.time)
          })
          describe('with partial rewards exausted', function () {
            beforeEach(async function () {
              await increaseTime(rewardScaling.time / 2)
              await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
            })
            it('should succeed', async function () {
              await geyser.connect(admin).fund(amplInitialSupply.div(2), rewardScaling.time)
            })
            it('should update state correctly', async function () {
              await geyser.connect(admin).fund(amplInitialSupply.div(2), rewardScaling.time)

              const data = await geyser.getAludelData()

              expect(data.rewardSharesOutstanding).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).mul(3).div(4))
              expect(data.rewardSchedules.length).to.eq(2)
              expect(data.rewardSchedules[0].duration).to.eq(rewardScaling.time)
              expect(data.rewardSchedules[0].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
              expect(data.rewardSchedules[1].duration).to.eq(rewardScaling.time)
              expect(data.rewardSchedules[1].start).to.eq(await getTimestamp())
              expect(data.rewardSchedules[1].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
            })
            it('should emit event', async function () {
              await expect(geyser.connect(admin).fund(amplInitialSupply.div(2), rewardScaling.time))
                .to.emit(geyser, 'AludelFunded')
                .withArgs(amplInitialSupply.div(2), rewardScaling.time)
            })
            it('should transfer tokens', async function () {
              await expect(geyser.connect(admin).fund(amplInitialSupply.div(2), rewardScaling.time))
                .to.emit(rewardToken, 'Transfer')
                .withArgs(admin.address, rewardPool.address, amplInitialSupply.div(2))
            })
          })
          describe('with full rewards exausted', function () {
            beforeEach(async function () {
              await increaseTime(rewardScaling.time)
              await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
            })
            it('should succeed', async function () {
              await geyser.connect(admin).fund(amplInitialSupply.div(2), rewardScaling.time)
            })
            it('should update state correctly', async function () {
              await geyser.connect(admin).fund(amplInitialSupply.div(2), rewardScaling.time)

              const data = await geyser.getAludelData()

              expect(data.rewardSharesOutstanding).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
              expect(data.rewardSchedules.length).to.eq(2)
              expect(data.rewardSchedules[0].duration).to.eq(rewardScaling.time)
              expect(data.rewardSchedules[0].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
              expect(data.rewardSchedules[1].duration).to.eq(rewardScaling.time)
              expect(data.rewardSchedules[1].start).to.eq(await getTimestamp())
              expect(data.rewardSchedules[1].shares).to.eq(amplInitialSupply.mul(BASE_SHARES_PER_WEI).div(2))
            })
            it('should emit event', async function () {
              await expect(geyser.connect(admin).fund(amplInitialSupply.div(2), rewardScaling.time))
                .to.emit(geyser, 'AludelFunded')
                .withArgs(amplInitialSupply.div(2), rewardScaling.time)
            })
            it('should transfer tokens', async function () {
              await expect(geyser.connect(admin).fund(amplInitialSupply.div(2), rewardScaling.time))
                .to.emit(rewardToken, 'Transfer')
                .withArgs(admin.address, rewardPool.address, amplInitialSupply.div(2))
            })
          })
        })
      })
    })

    describe('isValidVault', function () {
      let vault: Contract
      beforeEach(async function () {
        vault = await createInstance('Crucible', vaultFactory, user)
      })
      describe('when no factory registered', function () {
        it('should be false', async function () {
          expect(await geyser.isValidVault(vault.address)).to.be.false
        })
      })
      describe('when vault from factory registered', function () {
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
        })
        it('should be true', async function () {
          expect(await geyser.isValidVault(vault.address)).to.be.true
        })
      })
      describe('when vault from factory removed', function () {
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
          await geyser.connect(admin).removeVaultFactory(vaultFactory.address)
        })
        it('should be false', async function () {
          expect(await geyser.isValidVault(vault.address)).to.be.false
        })
      })
      describe('when vault not from factory registered', function () {
        let secondFactory: Contract
        let secondVault: Contract
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
          secondFactory = await deployContract('CrucibleFactory', [vaultTemplate.address])
          secondVault = await createInstance('Crucible', secondFactory, user)
        })
        it('should be false', async function () {
          expect(await geyser.isValidVault(secondVault.address)).to.be.false
        })
      })
      describe('when vaults from multiple factory registered', function () {
        let secondFactory: Contract
        let secondVault: Contract
        beforeEach(async function () {
          secondFactory = await deployContract('CrucibleFactory', [vaultTemplate.address])
          secondVault = await createInstance('Crucible', secondFactory, user)
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
          await geyser.connect(admin).registerVaultFactory(secondFactory.address)
        })
        it('should be true', async function () {
          expect(await geyser.isValidVault(vault.address)).to.be.true
          expect(await geyser.isValidVault(secondVault.address)).to.be.true
        })
      })
    })

    describe('registerVaultFactory', function () {
      describe('as user', function () {
        it('should fail', async function () {
          await expect(geyser.connect(user).registerVaultFactory(vaultFactory.address)).to.be.revertedWith(
            'Ownable: caller is not the owner',
          )
        })
      })
      describe('when online', function () {
        it('should succeed', async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
        })
        it('should update state', async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)

          expect(await geyser.getVaultFactorySetLength()).to.be.eq(1)
          expect(await geyser.getVaultFactoryAtIndex(0)).to.be.eq(vaultFactory.address)
        })
        it('should emit event', async function () {
          await expect(geyser.connect(admin).registerVaultFactory(vaultFactory.address))
            .to.emit(geyser, 'VaultFactoryRegistered')
            .withArgs(vaultFactory.address)
        })
      })
      describe('when offline', function () {
        beforeEach(async function () {
          await powerSwitch.connect(admin).powerOff()
        })
        it('should succeed', async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
        })
        it('should update state', async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)

          expect(await geyser.getVaultFactorySetLength()).to.be.eq(1)
          expect(await geyser.getVaultFactoryAtIndex(0)).to.be.eq(vaultFactory.address)
        })
        it('should emit event', async function () {
          await expect(geyser.connect(admin).registerVaultFactory(vaultFactory.address))
            .to.emit(geyser, 'VaultFactoryRegistered')
            .withArgs(vaultFactory.address)
        })
      })
      describe('when shutdown', function () {
        beforeEach(async function () {
          await powerSwitch.connect(admin).emergencyShutdown()
        })
        it('should fail', async function () {
          await expect(geyser.connect(admin).registerVaultFactory(vaultFactory.address)).to.be.revertedWith(
            'Powered: is shutdown',
          )
        })
      })
      describe('when already added', function () {
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
        })
        it('should fail', async function () {
          await expect(geyser.connect(admin).registerVaultFactory(vaultFactory.address)).to.be.revertedWith(
            'Aludel: vault factory already registered',
          )
        })
      })
      describe('when removed', function () {
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
          await geyser.connect(admin).removeVaultFactory(vaultFactory.address)
        })
        it('should succeed', async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
        })
        it('should update state', async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)

          expect(await geyser.getVaultFactorySetLength()).to.be.eq(1)
          expect(await geyser.getVaultFactoryAtIndex(0)).to.be.eq(vaultFactory.address)
        })
        it('should emit event', async function () {
          await expect(geyser.connect(admin).registerVaultFactory(vaultFactory.address))
            .to.emit(geyser, 'VaultFactoryRegistered')
            .withArgs(vaultFactory.address)
        })
      })
      describe('with second factory', function () {
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(admin.address)
        })
        it('should succeed', async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
        })
        it('should update state', async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)

          expect(await geyser.getVaultFactorySetLength()).to.be.eq(2)
          expect(await geyser.getVaultFactoryAtIndex(1)).to.be.eq(vaultFactory.address)
        })
        it('should emit event', async function () {
          await expect(geyser.connect(admin).registerVaultFactory(vaultFactory.address))
            .to.emit(geyser, 'VaultFactoryRegistered')
            .withArgs(vaultFactory.address)
        })
      })
    })
    describe('removeVaultFactory', function () {
      describe('as user', function () {
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
        })
        it('should fail', async function () {
          await expect(geyser.connect(user).removeVaultFactory(vaultFactory.address)).to.be.revertedWith(
            'Ownable: caller is not the owner',
          )
        })
      })
      describe('when online', function () {
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
        })
        it('should succeed', async function () {
          await geyser.connect(admin).removeVaultFactory(vaultFactory.address)
        })
        it('should update state', async function () {
          await geyser.connect(admin).removeVaultFactory(vaultFactory.address)

          expect(await geyser.getVaultFactorySetLength()).to.be.eq(0)
          await expect(geyser.getVaultFactoryAtIndex(0)).to.be.reverted
        })
        it('should emit event', async function () {
          await expect(geyser.connect(admin).removeVaultFactory(vaultFactory.address))
            .to.emit(geyser, 'VaultFactoryRemoved')
            .withArgs(vaultFactory.address)
        })
      })
      describe('when offline', function () {
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
          await powerSwitch.connect(admin).powerOff()
        })
        it('should succeed', async function () {
          await geyser.connect(admin).removeVaultFactory(vaultFactory.address)
        })
        it('should update state', async function () {
          await geyser.connect(admin).removeVaultFactory(vaultFactory.address)

          expect(await geyser.getVaultFactorySetLength()).to.be.eq(0)
          await expect(geyser.getVaultFactoryAtIndex(0)).to.be.reverted
        })
        it('should emit event', async function () {
          await expect(geyser.connect(admin).removeVaultFactory(vaultFactory.address))
            .to.emit(geyser, 'VaultFactoryRemoved')
            .withArgs(vaultFactory.address)
        })
      })
      describe('when shutdown', function () {
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
          await powerSwitch.connect(admin).emergencyShutdown()
        })
        it('should fail', async function () {
          await expect(geyser.connect(admin).removeVaultFactory(vaultFactory.address)).to.be.revertedWith(
            'Powered: is shutdown',
          )
        })
      })
      describe('when never added', function () {
        it('should fail', async function () {
          await expect(geyser.connect(admin).removeVaultFactory(vaultFactory.address)).to.be.revertedWith(
            'Aludel: vault factory not registered',
          )
        })
      })
      describe('when already removed', function () {
        beforeEach(async function () {
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
          await geyser.connect(admin).removeVaultFactory(vaultFactory.address)
        })
        it('should fail', async function () {
          await expect(geyser.connect(admin).removeVaultFactory(vaultFactory.address)).to.be.revertedWith(
            'Aludel: vault factory not registered',
          )
        })
      })
    })

    describe('registerBonusToken', function () {
      describe('as user', function () {
        it('should fail', async function () {
          await expect(geyser.connect(user).registerBonusToken(bonusToken.address)).to.be.revertedWith(
            'Ownable: caller is not the owner',
          )
        })
      })
      describe('when online', function () {
        describe('on first call', function () {
          describe('with address zero', function () {
            it('should fail', async function () {
              await expect(geyser.connect(admin).registerBonusToken(ethers.constants.AddressZero)).to.be.revertedWith(
                'Aludel: invalid address',
              )
            })
          })
          describe('with geyser address', function () {
            it('should fail', async function () {
              await expect(geyser.connect(admin).registerBonusToken(geyser.address)).to.be.revertedWith(
                'Aludel: invalid address',
              )
            })
          })
          describe('with staking token', function () {
            it('should fail', async function () {
              await expect(geyser.connect(admin).registerBonusToken(stakingToken.address)).to.be.revertedWith(
                'Aludel: invalid address',
              )
            })
          })
          describe('with reward token', function () {
            it('should fail', async function () {
              await expect(geyser.connect(admin).registerBonusToken(rewardToken.address)).to.be.revertedWith(
                'Aludel: invalid address',
              )
            })
          })
          describe('with rewardPool address', function () {
            it('should fail', async function () {
              await expect(geyser.connect(admin).registerBonusToken(rewardPool.address)).to.be.revertedWith(
                'Aludel: invalid address',
              )
            })
          })
          describe('with bonus token', function () {
            it('should succeed', async function () {
              await geyser.connect(admin).registerBonusToken(bonusToken.address)
            })
            it('should update state', async function () {
              await geyser.connect(admin).registerBonusToken(bonusToken.address)
              expect(await geyser.getBonusTokenSetLength()).to.eq(1)
              expect(await geyser.getBonusTokenAtIndex(0)).to.eq(bonusToken.address)
            })
            it('should emit event', async function () {
              await expect(geyser.connect(admin).registerBonusToken(bonusToken.address))
                .to.emit(geyser, 'BonusTokenRegistered')
                .withArgs(bonusToken.address)
            })
          })
        })
        describe('on second call', function () {
          beforeEach(async function () {
            await geyser.connect(admin).registerBonusToken(bonusToken.address)
          })
          describe('with same token', function () {
            it('should fail', async function () {
              await expect(geyser.connect(admin).registerBonusToken(bonusToken.address)).to.be.revertedWith(
                'Aludel: invalid address',
              )
            })
          })
          describe('with different bonus token', function () {
            let secondBonusToken: Contract
            beforeEach(async function () {
              secondBonusToken = await deployContract('MockERC20', [admin.address, mockTokenSupply])
            })
            it('should succeed', async function () {
              await geyser.connect(admin).registerBonusToken(secondBonusToken.address)
            })
            it('should update state', async function () {
              await geyser.connect(admin).registerBonusToken(secondBonusToken.address)
              expect(await geyser.getBonusTokenSetLength()).to.eq(2)
              expect(await geyser.getBonusTokenAtIndex(0)).to.eq(bonusToken.address)
              expect(await geyser.getBonusTokenAtIndex(1)).to.eq(secondBonusToken.address)
            })
            it('should emit event', async function () {
              await expect(geyser.connect(admin).registerBonusToken(secondBonusToken.address))
                .to.emit(geyser, 'BonusTokenRegistered')
                .withArgs(secondBonusToken.address)
            })
          })
        })
      })
      describe('when offline', function () {
        it('should fail', async function () {
          await powerSwitch.connect(admin).powerOff()
          await expect(geyser.connect(admin).registerBonusToken(bonusToken.address)).to.be.revertedWith(
            'Powered: is not online',
          )
        })
      })
      describe('when shutdown', function () {
        it('should fail', async function () {
          await powerSwitch.connect(admin).emergencyShutdown()
          await expect(geyser.connect(admin).registerBonusToken(bonusToken.address)).to.be.revertedWith(
            'Powered: is not online',
          )
        })
      })
    })

    describe('rescueTokensFromRewardPool', function () {
      let otherToken: Contract
      beforeEach(async function () {
        otherToken = await deployContract('MockERC20', [admin.address, mockTokenSupply])
        await otherToken.connect(admin).transfer(rewardPool.address, mockTokenSupply)
        await geyser.connect(admin).registerBonusToken(bonusToken.address)
      })
      describe('as user', function () {
        it('should fail', async function () {
          await expect(
            geyser.connect(user).rescueTokensFromRewardPool(otherToken.address, admin.address, mockTokenSupply),
          ).to.be.revertedWith('Ownable: caller is not the owner')
        })
      })
      describe('with reward token', function () {
        it('should fail', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(rewardToken.address, admin.address, mockTokenSupply),
          ).to.be.revertedWith('Aludel: invalid address')
        })
      })
      describe('with bonus token', function () {
        it('should fail', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(bonusToken.address, admin.address, mockTokenSupply),
          ).to.be.revertedWith('Aludel: invalid address')
        })
      })
      describe('with staking token', function () {
        beforeEach(async function () {
          await stakingToken.connect(admin).transfer(rewardPool.address, mockTokenSupply)
        })
        it('should succeed', async function () {
          await geyser.connect(admin).rescueTokensFromRewardPool(stakingToken.address, admin.address, mockTokenSupply)
        })
        it('should transfer tokens', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(stakingToken.address, admin.address, mockTokenSupply),
          )
            .to.emit(stakingToken, 'Transfer')
            .withArgs(rewardPool.address, admin.address, mockTokenSupply)
        })
      })
      describe('with geyser as recipient', function () {
        it('should fail', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, geyser.address, mockTokenSupply),
          ).to.be.revertedWith('Aludel: invalid address')
        })
      })
      describe('with staking token as recipient', function () {
        it('should fail', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, stakingToken.address, mockTokenSupply),
          ).to.be.revertedWith('Aludel: invalid address')
        })
      })
      describe('with reward token as recipient', function () {
        it('should fail', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, rewardToken.address, mockTokenSupply),
          ).to.be.revertedWith('Aludel: invalid address')
        })
      })
      describe('with rewardPool as recipient', function () {
        it('should fail', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, rewardPool.address, mockTokenSupply),
          ).to.be.revertedWith('Aludel: invalid address')
        })
      })
      describe('with address 0 as recipient', function () {
        it('should fail', async function () {
          await expect(
            geyser
              .connect(admin)
              .rescueTokensFromRewardPool(otherToken.address, ethers.constants.AddressZero, mockTokenSupply),
          ).to.be.revertedWith('Aludel: invalid address')
        })
      })
      describe('with other address as recipient', function () {
        it('should succeed', async function () {
          await geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, user.address, mockTokenSupply)
        })
        it('should transfer tokens', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, user.address, mockTokenSupply),
          )
            .to.emit(otherToken, 'Transfer')
            .withArgs(rewardPool.address, user.address, mockTokenSupply)
        })
      })
      describe('with zero amount', function () {
        it('should succeed', async function () {
          await geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, admin.address, 0)
        })
        it('should transfer tokens', async function () {
          await expect(geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, admin.address, 0))
            .to.emit(otherToken, 'Transfer')
            .withArgs(rewardPool.address, admin.address, 0)
        })
      })
      describe('with partial amount', function () {
        it('should succeed', async function () {
          await geyser
            .connect(admin)
            .rescueTokensFromRewardPool(otherToken.address, admin.address, mockTokenSupply.div(2))
        })
        it('should transfer tokens', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, admin.address, mockTokenSupply.div(2)),
          )
            .to.emit(otherToken, 'Transfer')
            .withArgs(rewardPool.address, admin.address, mockTokenSupply.div(2))
        })
      })
      describe('with full amount', function () {
        it('should succeed', async function () {
          await geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, admin.address, mockTokenSupply)
        })
        it('should transfer tokens', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, admin.address, mockTokenSupply),
          )
            .to.emit(otherToken, 'Transfer')
            .withArgs(rewardPool.address, admin.address, mockTokenSupply)
        })
      })
      describe('with excess amount', function () {
        it('should fail', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, admin.address, mockTokenSupply.mul(2)),
          ).to.be.revertedWith('')
        })
      })
      describe('when online', function () {
        it('should succeed', async function () {
          await geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, admin.address, mockTokenSupply)
        })
        it('should transfer tokens', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, admin.address, mockTokenSupply),
          )
            .to.emit(otherToken, 'Transfer')
            .withArgs(rewardPool.address, admin.address, mockTokenSupply)
        })
      })
      describe('when offline', function () {
        beforeEach(async function () {
          await powerSwitch.connect(admin).powerOff()
        })
        it('should fail', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, admin.address, mockTokenSupply),
          ).to.be.revertedWith('Powered: is not online')
        })
      })
      describe('when shutdown', function () {
        beforeEach(async function () {
          await powerSwitch.connect(admin).emergencyShutdown()
        })
        it('should fail', async function () {
          await expect(
            geyser.connect(admin).rescueTokensFromRewardPool(otherToken.address, admin.address, mockTokenSupply),
          ).to.be.revertedWith('Powered: is not online')
        })
      })
    })
  })

  describe('user functions', function () {
    let geyser: Contract, powerSwitch: Contract, rewardPool: Contract
    beforeEach(async function () {
      const args = [
        admin.address,
        rewardPoolFactory.address,
        powerSwitchFactory.address,
        stakingToken.address,
        rewardToken.address,
        [rewardScaling.floor, rewardScaling.ceiling, rewardScaling.time],
      ]
      geyser = await deployAludel(args)
      await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
      powerSwitch = await ethers.getContractAt('PowerSwitch', await geyser.getPowerSwitch())
      rewardPool = await ethers.getContractAt('RewardPool', (await geyser.getAludelData()).rewardPool)
    })

    describe('stake', function () {
      const stakeAmount = mockTokenSupply.div(100)
      let vault: Contract

      beforeEach(async function () {
        vault = await createInstance('Crucible', vaultFactory, user)
        await stakingToken.connect(admin).transfer(vault.address, stakeAmount)
      })
      describe('when offline', function () {
        it('should fail', async function () {
          await powerSwitch.connect(admin).powerOff()
          await expect(stake(user, geyser, vault, stakingToken, stakeAmount)).to.be.revertedWith(
            'Powered: is not online',
          )
        })
      })
      describe('when shutdown', function () {
        it('should fail', async function () {
          await powerSwitch.connect(admin).emergencyShutdown()
          await expect(stake(user, geyser, vault, stakingToken, stakeAmount)).to.be.revertedWith(
            'Powered: is not online',
          )
        })
      })
      describe('to invalid vault', function () {
        it('should fail', async function () {
          await geyser.connect(admin).removeVaultFactory(vaultFactory.address)
          await expect(stake(user, geyser, vault, stakingToken, stakeAmount)).to.be.revertedWith(
            'Aludel: vault is not registered',
          )
        })
      })
      describe('with amount of zero', function () {
        it('should fail', async function () {
          await expect(stake(user, geyser, vault, stakingToken, '0')).to.be.revertedWith('Aludel: no amount staked')
        })
      })
      describe('with insufficient balance', function () {
        it('should fail', async function () {
          await expect(stake(user, geyser, vault, stakingToken, stakeAmount.mul(2))).to.be.revertedWith(
            'Crucible: insufficient balance',
          )
        })
      })
      describe('when not funded', function () {
        it('should succeed', async function () {
          await stake(user, geyser, vault, stakingToken, stakeAmount)
        })
      })
      describe('when funded', function () {
        beforeEach(async function () {
          await rewardToken.connect(admin).approve(geyser.address, amplInitialSupply)
          await geyser.connect(admin).fund(amplInitialSupply, YEAR)
        })
        describe('on first stake', function () {
          describe('as vault owner', function () {
            it('should succeed', async function () {
              await stake(user, geyser, vault, stakingToken, stakeAmount)
            })
            it('should update state', async function () {
              await stake(user, geyser, vault, stakingToken, stakeAmount)

              const geyserData = await geyser.getAludelData()
              const vaultData = await geyser.getVaultData(vault.address)

              expect(geyserData.totalStake).to.eq(stakeAmount)
              expect(geyserData.totalStakeUnits).to.eq(0)
              expect(geyserData.lastUpdate).to.eq(await getTimestamp())

              expect(vaultData.totalStake).to.eq(stakeAmount)
              expect(vaultData.stakes.length).to.eq(1)
              expect(vaultData.stakes[0].amount).to.eq(stakeAmount)
              expect(vaultData.stakes[0].timestamp).to.eq(await getTimestamp())
            })
            it('should emit event', async function () {
              await expect(stake(user, geyser, vault, stakingToken, stakeAmount))
                .to.emit(geyser, 'Staked')
                .withArgs(vault.address, stakeAmount)
            })
            it('should lock tokens', async function () {
              await expect(stake(user, geyser, vault, stakingToken, stakeAmount))
                .to.emit(vault, 'Locked')
                .withArgs(geyser.address, stakingToken.address, stakeAmount)
            })
          })
        })
        describe('on second stake', function () {
          beforeEach(async function () {
            await stake(user, geyser, vault, stakingToken, stakeAmount.div(2))
          })
          it('should succeed', async function () {
            await stake(user, geyser, vault, stakingToken, stakeAmount.div(2))
          })
          it('should update state', async function () {
            await stake(user, geyser, vault, stakingToken, stakeAmount.div(2))

            const geyserData = await geyser.getAludelData()
            const vaultData = await geyser.getVaultData(vault.address)

            expect(geyserData.totalStake).to.eq(stakeAmount)
            expect(geyserData.totalStakeUnits).to.eq(stakeAmount.div(2))
            expect(geyserData.lastUpdate).to.eq(await getTimestamp())

            expect(vaultData.totalStake).to.eq(stakeAmount)
            expect(vaultData.stakes.length).to.eq(2)
            expect(vaultData.stakes[0].amount).to.eq(stakeAmount.div(2))
            expect(vaultData.stakes[0].timestamp).to.eq((await getTimestamp()) - 1)
            expect(vaultData.stakes[1].amount).to.eq(stakeAmount.div(2))
            expect(vaultData.stakes[1].timestamp).to.eq(await getTimestamp())
          })
          it('should emit event', async function () {
            await expect(stake(user, geyser, vault, stakingToken, stakeAmount.div(2)))
              .to.emit(geyser, 'Staked')
              .withArgs(vault.address, stakeAmount.div(2))
          })
          it('should lock tokens', async function () {
            await expect(stake(user, geyser, vault, stakingToken, stakeAmount.div(2)))
              .to.emit(vault, 'Locked')
              .withArgs(geyser.address, stakingToken.address, stakeAmount.div(2))
          })
        })
        describe('when MAX_STAKES_PER_VAULT reached', function () {
          let quantity: number
          beforeEach(async function () {
            quantity = (await geyser.MAX_STAKES_PER_VAULT()).toNumber()
            for (let index = 0; index < quantity; index++) {
              await stake(user, geyser, vault, stakingToken, stakeAmount.div(quantity))
            }
          })
          it('should fail', async function () {
            await expect(stake(user, geyser, vault, stakingToken, stakeAmount.div(quantity))).to.be.revertedWith(
              'Aludel: MAX_STAKES_PER_VAULT reached',
            )
          })
        })
      })
      describe('when stakes reset', function () {
        beforeEach(async function () {
          await stake(user, geyser, vault, stakingToken, stakeAmount)
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
        })
        it('should succeed', async function () {
          await stake(user, geyser, vault, stakingToken, stakeAmount)
        })
        it('should update state', async function () {
          await stake(user, geyser, vault, stakingToken, stakeAmount)

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.totalStake).to.eq(stakeAmount)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())

          expect(vaultData.totalStake).to.eq(stakeAmount)
          expect(vaultData.stakes.length).to.eq(1)
          expect(vaultData.stakes[0].amount).to.eq(stakeAmount)
          expect(vaultData.stakes[0].timestamp).to.eq(await getTimestamp())
        })
        it('should emit event', async function () {
          await expect(stake(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(geyser, 'Staked')
            .withArgs(vault.address, stakeAmount)
        })
        it('should lock tokens', async function () {
          await expect(stake(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(vault, 'Locked')
            .withArgs(geyser.address, stakingToken.address, stakeAmount)
        })
      })
    })

    describe('unstake', function () {
      const stakeAmount = ethers.utils.parseEther('100')
      const rewardAmount = ethers.utils.parseUnits('1000', 9)

      describe('with default config', function () {
        let vault: Contract
        beforeEach(async function () {
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          vault = await createInstance('Crucible', vaultFactory, user)

          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

          await stake(user, geyser, vault, stakingToken, stakeAmount)

          await increaseTime(rewardScaling.time)
        })
        describe('when offline', function () {
          it('should fail', async function () {
            await powerSwitch.connect(admin).powerOff()
            await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)).to.be.revertedWith(
              'Powered: is not online',
            )
          })
        })
        describe('when shutdown', function () {
          it('should fail', async function () {
            await powerSwitch.connect(admin).emergencyShutdown()
            await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)).to.be.revertedWith(
              'Powered: is not online',
            )
          })
        })
        describe('with invalid vault', function () {
          it('should succeed', async function () {
            await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          })
        })
        describe('with permissioned not signed by owner', function () {
          it('should fail', async function () {
            await expect(
              unstakeAndClaim(Wallet.createRandom().connect(ethers.provider), geyser, vault, stakingToken, stakeAmount),
            ).to.be.revertedWith('ERC1271: Invalid signature')
          })
        })
        describe('with amount of zero', function () {
          it('should fail', async function () {
            await expect(unstakeAndClaim(user, geyser, vault, stakingToken, 0)).to.be.revertedWith(
              'Aludel: no amount unstaked',
            )
          })
        })
        describe('with amount greater than stakes', function () {
          it('should fail', async function () {
            await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount.add(1))).to.be.revertedWith(
              'Aludel: insufficient vault stake',
            )
          })
        })
      })
      describe('with fully vested stake', function () {
        let vault: Contract
        beforeEach(async function () {
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          vault = await createInstance('Crucible', vaultFactory, user)

          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

          await stake(user, geyser, vault, stakingToken, stakeAmount)

          await increaseTime(rewardScaling.time)
        })
        it('should succeed', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
        })
        it('should update state', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(0)
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
        it('should emit event', async function () {
          const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
          await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, rewardAmount)
        })
        it('should transfer tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(rewardToken, 'Transfer')
            .withArgs(rewardPool.address, vault.address, rewardAmount)
        })
        it('should unlock tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, stakeAmount)
        })
      })
      describe('with partially vested stake', function () {
        const stakeDuration = rewardScaling.time / 2
        const expectedReward = calculateExpectedReward(stakeAmount, stakeDuration, rewardAmount, 0)

        let vault: Contract
        beforeEach(async function () {
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          vault = await createInstance('Crucible', vaultFactory, user)

          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

          await stake(user, geyser, vault, stakingToken, stakeAmount)

          await increaseTime(stakeDuration)
        })
        it('should succeed', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
        })
        it('should update state', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.sub(expectedReward).mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
        it('should emit event', async function () {
          const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
          await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, expectedReward)
        })
        it('should transfer tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(rewardToken, 'Transfer')
            .withArgs(rewardPool.address, vault.address, expectedReward)
        })
        it('should unlock tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, stakeAmount)
        })
      })
      describe('with floor and ceiling scaled up', function () {
        const stakeDuration = rewardScaling.time / 2
        const expectedReward = calculateExpectedReward(stakeAmount, stakeDuration, rewardAmount, 0)

        let vault: Contract
        beforeEach(async function () {
          const args = [
            admin.address,
            rewardPoolFactory.address,
            powerSwitchFactory.address,
            stakingToken.address,
            rewardToken.address,

            [rewardScaling.floor * 2, rewardScaling.ceiling * 2, rewardScaling.time],
          ]
          geyser = await deployAludel(args)
          await geyser.connect(admin).registerVaultFactory(vaultFactory.address)
          powerSwitch = await ethers.getContractAt('PowerSwitch', await geyser.getPowerSwitch())
          rewardPool = await ethers.getContractAt('RewardPool', (await geyser.getAludelData()).rewardPool)

          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          vault = await createInstance('Crucible', vaultFactory, user)

          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

          await stake(user, geyser, vault, stakingToken, stakeAmount)

          await increaseTime(stakeDuration)
        })
        it('should succeed', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
        })
        it('should update state', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.sub(expectedReward).mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
        it('should emit event', async function () {
          const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
          await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, expectedReward)
        })
        it('should transfer tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(rewardToken, 'Transfer')
            .withArgs(rewardPool.address, vault.address, expectedReward)
        })
        it('should unlock tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, stakeAmount)
        })
      })
      describe('with no reward', function () {
        let vault: Contract
        beforeEach(async function () {
          vault = await createInstance('Crucible', vaultFactory, user)

          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

          await stake(user, geyser, vault, stakingToken, stakeAmount)

          await increaseTime(rewardScaling.time)
        })
        it('should succeed', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
        })
        it('should update state', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(0)
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
        it('should emit event', async function () {
          const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
        })
        it('should unlock tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, stakeAmount)
        })
      })
      describe('with partially vested reward', function () {
        const expectedReward = calculateExpectedReward(stakeAmount, rewardScaling.time, rewardAmount.div(2), 0)

        let vault: Contract
        beforeEach(async function () {
          vault = await createInstance('Crucible', vaultFactory, user)

          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

          await stake(user, geyser, vault, stakingToken, stakeAmount)

          await increaseTime(rewardScaling.time)

          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time / 2)
        })
        it('should succeed', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
        })
        it('should update state', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.sub(expectedReward).mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
        it('should emit event', async function () {
          const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
          await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, expectedReward)
        })
        it('should transfer tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(rewardToken, 'Transfer')
            .withArgs(rewardPool.address, vault.address, expectedReward)
        })
        it('should unlock tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, stakeAmount)
        })
      })
      describe('with flash stake', function () {
        let vault: Contract, MockStakeHelper: Contract

        beforeEach(async function () {
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          vault = await createInstance('Crucible', vaultFactory, user)

          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

          MockStakeHelper = await deployContract('MockStakeHelper')
        })
        it('should succeed', async function () {
          await MockStakeHelper.flashStake(
            geyser.address,
            vault.address,
            stakeAmount,
            await signPermission('Lock', vault, user, geyser.address, stakingToken.address, stakeAmount),
            await signPermission(
              'Unlock',
              vault,
              user,
              geyser.address,
              stakingToken.address,
              stakeAmount,
              (await vault.getNonce()).add(1),
            ),
          )
        })
        it('should update state', async function () {
          await MockStakeHelper.flashStake(
            geyser.address,
            vault.address,
            stakeAmount,
            await signPermission('Lock', vault, user, geyser.address, stakingToken.address, stakeAmount),
            await signPermission(
              'Unlock',
              vault,
              user,
              geyser.address,
              stakingToken.address,
              stakeAmount,
              (await vault.getNonce()).add(1),
            ),
          )

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
        it('should emit event', async function () {
          const tx = MockStakeHelper.flashStake(
            geyser.address,
            vault.address,
            stakeAmount,
            await signPermission('Lock', vault, user, geyser.address, stakingToken.address, stakeAmount),
            await signPermission(
              'Unlock',
              vault,
              user,
              geyser.address,
              stakingToken.address,
              stakeAmount,
              (await vault.getNonce()).add(1),
            ),
          )
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
        })
        it('should lock tokens', async function () {
          await expect(
            MockStakeHelper.flashStake(
              geyser.address,
              vault.address,
              stakeAmount,
              await signPermission('Lock', vault, user, geyser.address, stakingToken.address, stakeAmount),
              await signPermission(
                'Unlock',
                vault,
                user,
                geyser.address,
                stakingToken.address,
                stakeAmount,
                (await vault.getNonce()).add(1),
              ),
            ),
          )
            .to.emit(vault, 'Locked')
            .withArgs(geyser.address, stakingToken.address, stakeAmount)
        })
        it('should unlock tokens', async function () {
          await expect(
            MockStakeHelper.flashStake(
              geyser.address,
              vault.address,
              stakeAmount,
              await signPermission('Lock', vault, user, geyser.address, stakingToken.address, stakeAmount),
              await signPermission(
                'Unlock',
                vault,
                user,
                geyser.address,
                stakingToken.address,
                stakeAmount,
                (await vault.getNonce()).add(1),
              ),
            ),
          )
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, stakeAmount)
        })
      })
      describe('with one second stake', function () {
        const stakeDuration = 1
        const expectedReward = calculateExpectedReward(stakeAmount, stakeDuration, rewardAmount, 0)

        let vault: Contract
        beforeEach(async function () {
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          vault = await createInstance('Crucible', vaultFactory, user)

          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

          await stake(user, geyser, vault, stakingToken, stakeAmount)

          await network.provider.request({
            method: 'evm_increaseTime',
            params: [1],
          })
        })
        it('should succeed', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
        })
        it('should update state', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.sub(expectedReward).mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
        it('should emit event', async function () {
          const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
          await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, expectedReward)
        })
        it('should transfer tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(rewardToken, 'Transfer')
            .withArgs(rewardPool.address, vault.address, expectedReward)
        })
        it('should unlock tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, stakeAmount)
        })
      })
      describe('with partial amount from single stake', function () {
        const expectedReward = calculateExpectedReward(
          stakeAmount.div(2),
          rewardScaling.time,
          rewardAmount,
          stakeAmount.div(2).mul(rewardScaling.time),
        )

        let vault: Contract
        beforeEach(async function () {
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          vault = await createInstance('Crucible', vaultFactory, user)

          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

          await stake(user, geyser, vault, stakingToken, stakeAmount)

          await increaseTime(rewardScaling.time)
        })
        it('should succeed', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount.div(2))
        })
        it('should update state', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount.div(2))

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.sub(expectedReward).mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(stakeAmount.div(2))
          expect(geyserData.totalStakeUnits).to.eq(stakeAmount.div(2).mul(rewardScaling.time))
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(stakeAmount.div(2))
          expect(vaultData.stakes.length).to.eq(1)
          expect(vaultData.stakes[0].amount).to.eq(stakeAmount.div(2))
        })
        it('should emit event', async function () {
          const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount.div(2))
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount.div(2))
          await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, expectedReward)
        })
        it('should transfer tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount.div(2)))
            .to.emit(rewardToken, 'Transfer')
            .withArgs(rewardPool.address, vault.address, expectedReward)
        })
        it('should unlock tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount.div(2)))
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, stakeAmount.div(2))
        })
      })
      describe('with partial amount from multiple stakes', function () {
        const currentStake = ethers.utils.parseEther('99')
        const unstakedAmount = currentStake.div(2)
        const expectedReward = calculateExpectedReward(
          unstakedAmount,
          rewardScaling.time,
          rewardAmount,
          currentStake.div(2).mul(rewardScaling.time),
        ).sub(1) // account for division dust
        const quantity = 3

        let vault: Contract
        beforeEach(async function () {
          // fund geyser
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          // deploy vault and transfer stake
          vault = await createInstance('Crucible', vaultFactory, user)
          await stakingToken.connect(admin).transfer(vault.address, currentStake)

          // perform multiple stakes in same block
          const permissions = []
          for (let index = 0; index < quantity; index++) {
            permissions.push(
              await signPermission(
                'Lock',
                vault,
                user,
                geyser.address,
                stakingToken.address,
                currentStake.div(quantity),
                index,
              ),
            )
          }
          const MockStakeHelper = await deployContract('MockStakeHelper')
          await MockStakeHelper.stakeBatch(
            new Array(quantity).fill(undefined).map(() => geyser.address),
            new Array(quantity).fill(undefined).map(() => vault.address),
            new Array(quantity).fill(undefined).map(() => currentStake.div(quantity)),
            permissions,
          )

          // increase time to the end of reward scaling
          await increaseTime(rewardScaling.time)
        })
        it('should succeed', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount)
        })
        it('should update state', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount)

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.sub(expectedReward).mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(currentStake.sub(unstakedAmount))
          expect(geyserData.totalStakeUnits).to.eq(currentStake.sub(unstakedAmount).mul(rewardScaling.time))
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(currentStake.sub(unstakedAmount))
          expect(vaultData.stakes.length).to.eq(2)
          expect(vaultData.stakes[0].amount).to.eq(currentStake.div(3))
          expect(vaultData.stakes[1].amount).to.eq(currentStake.div(6))
        })
        it('should emit event', async function () {
          const tx = unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount)
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, unstakedAmount)
          await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, expectedReward)
        })
        it('should transfer tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount))
            .to.emit(rewardToken, 'Transfer')
            .withArgs(rewardPool.address, vault.address, expectedReward)
        })
        it('should transfer tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount))
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, unstakedAmount)
        })
      })
      describe('with full amount of the last of multiple stakes', function () {
        const currentStake = ethers.utils.parseEther('99')
        const unstakedAmount = currentStake.div(3)
        const expectedReward = calculateExpectedReward(
          unstakedAmount,
          rewardScaling.time,
          rewardAmount,
          currentStake.sub(unstakedAmount).mul(rewardScaling.time),
        )

        const quantity = 3

        let vault: Contract
        beforeEach(async function () {
          // fund geyser
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          // deploy vault and transfer stake
          vault = await createInstance('Crucible', vaultFactory, user)
          await stakingToken.connect(admin).transfer(vault.address, currentStake)

          // perform multiple stakes in same block
          const permissions = []
          for (let index = 0; index < quantity; index++) {
            permissions.push(
              await signPermission(
                'Lock',
                vault,
                user,
                geyser.address,
                stakingToken.address,
                currentStake.div(quantity),
                index,
              ),
            )
          }
          const MockStakeHelper = await deployContract('MockStakeHelper')
          await MockStakeHelper.stakeBatch(
            new Array(quantity).fill(geyser.address),
            new Array(quantity).fill(vault.address),
            new Array(quantity).fill(currentStake.div(quantity)),
            permissions,
          )

          // increase time to the end of reward scaling
          await increaseTime(rewardScaling.time)
        })
        it('should succeed', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount)
        })
        it('should update state', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount)

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.sub(expectedReward).mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(currentStake.sub(unstakedAmount))
          expect(geyserData.totalStakeUnits).to.eq(currentStake.sub(unstakedAmount).mul(rewardScaling.time))
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(currentStake.sub(unstakedAmount))
          expect(vaultData.stakes.length).to.eq(2)
          expect(vaultData.stakes[0].amount).to.eq(currentStake.div(3))
          expect(vaultData.stakes[1].amount).to.eq(currentStake.div(3))
        })
        it('should emit event', async function () {
          const tx = unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount)
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, unstakedAmount)
          await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, expectedReward)
        })
        it('should transfer tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount))
            .to.emit(rewardToken, 'Transfer')
            .withArgs(rewardPool.address, vault.address, expectedReward)
        })
        it('should unlock tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount))
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, unstakedAmount)
        })
      })
      describe('with full amount of multiple stakes', function () {
        const currentStake = ethers.utils.parseEther('99')
        const unstakedAmount = currentStake
        const expectedReward = calculateExpectedReward(unstakedAmount, rewardScaling.time, rewardAmount, 0)
        const quantity = 3

        let vault: Contract
        beforeEach(async function () {
          // fund geyser
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          // deploy vault and transfer stake
          vault = await createInstance('Crucible', vaultFactory, user)
          await stakingToken.connect(admin).transfer(vault.address, currentStake)

          // perform multiple stakes in same block
          const permissions = []
          for (let index = 0; index < quantity; index++) {
            permissions.push(
              await signPermission(
                'Lock',
                vault,
                user,
                geyser.address,
                stakingToken.address,
                currentStake.div(quantity),
                index,
              ),
            )
          }
          const MockStakeHelper = await deployContract('MockStakeHelper')
          await MockStakeHelper.stakeBatch(
            new Array(quantity).fill(geyser.address),
            new Array(quantity).fill(vault.address),
            new Array(quantity).fill(currentStake.div(quantity)),
            permissions,
          )

          // increase time to the end of reward scaling
          await increaseTime(rewardScaling.time)
        })
        it('should succeed', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount)
        })
        it('should update state', async function () {
          await unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount)

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(0)
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
        it('should emit event', async function () {
          const tx = unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount)
          await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, unstakedAmount)
          await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, expectedReward)
        })
        it('should transfer tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount))
            .to.emit(rewardToken, 'Transfer')
            .withArgs(rewardPool.address, vault.address, expectedReward)
        })
        it('should unlock tokens', async function () {
          await expect(unstakeAndClaim(user, geyser, vault, stakingToken, unstakedAmount))
            .to.emit(vault, 'Unlocked')
            .withArgs(geyser.address, stakingToken.address, unstakedAmount)
        })
      })
      describe('when one bonus token', function () {
        let vault: Contract
        beforeEach(async function () {
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          await geyser.connect(admin).registerBonusToken(bonusToken.address)

          vault = await createInstance('Crucible', vaultFactory, user)

          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)
        })
        describe('with no bonus token balance', function () {
          beforeEach(async function () {
            await stake(user, geyser, vault, stakingToken, stakeAmount)
            await increaseTime(rewardScaling.time)
          })
          it('should succeed', async function () {
            await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          })
          it('should update state', async function () {
            await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)

            const geyserData = await geyser.getAludelData()
            const vaultData = await geyser.getVaultData(vault.address)

            expect(geyserData.rewardSharesOutstanding).to.eq(0)
            expect(geyserData.totalStake).to.eq(0)
            expect(geyserData.totalStakeUnits).to.eq(0)
            expect(geyserData.lastUpdate).to.eq(await getTimestamp())
            expect(vaultData.totalStake).to.eq(0)
            expect(vaultData.stakes.length).to.eq(0)
          })
          it('should emit event', async function () {
            const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
            await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
            await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, rewardAmount)
          })
          it('should transfer tokens', async function () {
            const txPromise = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
            await expect(txPromise)
              .to.emit(rewardToken, 'Transfer')
              .withArgs(rewardPool.address, vault.address, rewardAmount)
          })
          it('should unlock tokens', async function () {
            await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
              .to.emit(vault, 'Unlocked')
              .withArgs(geyser.address, stakingToken.address, stakeAmount)
          })
        })
        describe('with fully vested stake', function () {
          beforeEach(async function () {
            await bonusToken.connect(admin).transfer(rewardPool.address, mockTokenSupply)

            await stake(user, geyser, vault, stakingToken, stakeAmount)

            await increaseTime(rewardScaling.time)
          })
          it('should succeed', async function () {
            await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          })
          it('should update state', async function () {
            await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)

            const geyserData = await geyser.getAludelData()
            const vaultData = await geyser.getVaultData(vault.address)

            expect(geyserData.rewardSharesOutstanding).to.eq(0)
            expect(geyserData.totalStake).to.eq(0)
            expect(geyserData.totalStakeUnits).to.eq(0)
            expect(geyserData.lastUpdate).to.eq(await getTimestamp())
            expect(vaultData.totalStake).to.eq(0)
            expect(vaultData.stakes.length).to.eq(0)
          })
          it('should emit event', async function () {
            const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
            await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
            await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, rewardToken.address, rewardAmount)
            await expect(tx)
              .to.emit(geyser, 'RewardClaimed')
              .withArgs(vault.address, bonusToken.address, mockTokenSupply)
          })
          it('should transfer tokens', async function () {
            const txPromise = unstakeAndClaim(
              user,

              geyser,
              vault,
              stakingToken,
              stakeAmount,
            )
            await expect(txPromise)
              .to.emit(rewardToken, 'Transfer')
              .withArgs(rewardPool.address, vault.address, rewardAmount)
            await expect(txPromise)
              .to.emit(bonusToken, 'Transfer')
              .withArgs(rewardPool.address, vault.address, mockTokenSupply)
          })
          it('should unlock tokens', async function () {
            await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
              .to.emit(vault, 'Unlocked')
              .withArgs(geyser.address, stakingToken.address, stakeAmount)
          })
        })
        describe('with partially vested stake', function () {
          const stakeDuration = rewardScaling.time / 2
          const expectedReward = calculateExpectedReward(stakeAmount, stakeDuration, rewardAmount, 0)
          const expectedBonus = calculateExpectedReward(stakeAmount, stakeDuration, mockTokenSupply, 0)
          beforeEach(async function () {
            await bonusToken.connect(admin).transfer(rewardPool.address, mockTokenSupply)

            await stake(user, geyser, vault, stakingToken, stakeAmount)

            await increaseTime(stakeDuration)
          })
          it('should succeed', async function () {
            await unstakeAndClaim(
              user,

              geyser,
              vault,
              stakingToken,
              stakeAmount,
            )
          })
          it('should update state', async function () {
            await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)

            const geyserData = await geyser.getAludelData()
            const vaultData = await geyser.getVaultData(vault.address)

            expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.sub(expectedReward).mul(BASE_SHARES_PER_WEI))
            expect(geyserData.totalStake).to.eq(0)
            expect(geyserData.totalStakeUnits).to.eq(0)
            expect(geyserData.lastUpdate).to.eq(await getTimestamp())
            expect(vaultData.totalStake).to.eq(0)
            expect(vaultData.stakes.length).to.eq(0)
          })
          it('should emit event', async function () {
            const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
            await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
            await expect(tx)
              .to.emit(geyser, 'RewardClaimed')
              .withArgs(vault.address, rewardToken.address, expectedReward)
            await expect(tx).to.emit(geyser, 'RewardClaimed').withArgs(vault.address, bonusToken.address, expectedBonus)
          })
          it('should transfer tokens', async function () {
            const txPromise = unstakeAndClaim(
              user,

              geyser,
              vault,
              stakingToken,
              stakeAmount,
            )
            await expect(txPromise)
              .to.emit(rewardToken, 'Transfer')
              .withArgs(rewardPool.address, vault.address, expectedReward)
            await expect(txPromise)
              .to.emit(bonusToken, 'Transfer')
              .withArgs(rewardPool.address, vault.address, expectedBonus)
          })
          it('should unlock tokens', async function () {
            await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
              .to.emit(vault, 'Unlocked')
              .withArgs(geyser.address, stakingToken.address, stakeAmount)
          })
        })
      })
      describe('with multiple vaults', function () {
        const stakeAmount = ethers.utils.parseEther('1')
        const rewardAmount = ethers.utils.parseUnits('1000', 9)
        const quantity = 10

        let vaults: Array<Contract>
        beforeEach(async function () {
          // fund geyser
          await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
          await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

          await increaseTime(rewardScaling.time)

          // create vaults
          vaults = []
          const permissions = []
          for (let index = 0; index < quantity; index++) {
            const vault = await createInstance('Crucible', vaultFactory, user)
            await stakingToken.connect(admin).transfer(vault.address, stakeAmount)

            vaults.push(vault)

            permissions.push(
              await signPermission('Lock', vault, user, geyser.address, stakingToken.address, stakeAmount),
            )
          }

          // stake in same block
          const MockStakeHelper = await deployContract('MockStakeHelper')
          await MockStakeHelper.stakeBatch(
            new Array(quantity).fill(geyser.address),
            vaults.map((vault) => vault.address),
            new Array(quantity).fill(stakeAmount),
            permissions,
          )

          // increase time to end of reward scaling
          await increaseTime(rewardScaling.time)
        })
        it('should succeed', async function () {
          for (const vault of vaults) {
            await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          }
        })
        it('should update state', async function () {
          for (const vault of vaults) {
            await unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
          }

          const geyserData = await geyser.getAludelData()

          expect(geyserData.rewardSharesOutstanding).to.eq(0)
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
        })
        it('should emit event', async function () {
          for (const vault of vaults) {
            const tx = unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount)
            await expect(tx).to.emit(geyser, 'Unstaked').withArgs(vault.address, stakeAmount)
            await expect(tx)
              .to.emit(geyser, 'RewardClaimed')
              .withArgs(vault.address, rewardToken.address, rewardAmount.div(quantity))
          }
        })
        it('should transfer tokens', async function () {
          for (const vault of vaults) {
            await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
              .to.emit(rewardToken, 'Transfer')
              .withArgs(rewardPool.address, vault.address, rewardAmount.div(quantity))
          }
        })
        it('should unlock tokens', async function () {
          for (const vault of vaults) {
            await expect(unstakeAndClaim(user, geyser, vault, stakingToken, stakeAmount))
              .to.emit(vault, 'Unlocked')
              .withArgs(geyser.address, stakingToken.address, stakeAmount)
          }
        })
      })
    })

    describe('rageQuit', function () {
      const stakeAmount = ethers.utils.parseEther('100')
      const rewardAmount = ethers.utils.parseUnits('1000', 9)
      const gasLimit = 600_000

      let vault: Contract
      beforeEach(async function () {
        // fund geyser
        await rewardToken.connect(admin).approve(geyser.address, rewardAmount)
        await geyser.connect(admin).fund(rewardAmount, rewardScaling.time)

        // create vault
        vault = await createInstance('Crucible', vaultFactory, user)

        // stake
        await stakingToken.connect(admin).transfer(vault.address, stakeAmount)
        await stake(user, geyser, vault, stakingToken, stakeAmount)
      })
      describe('when online', function () {
        it('should succeed', async function () {
          await vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
            gasLimit,
          })
        })
        it('should update state', async function () {
          await vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
            gasLimit,
          })

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
      })
      describe('when offline', function () {
        beforeEach(async function () {
          await powerSwitch.connect(admin).powerOff()
        })
        it('should succeed', async function () {
          await vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
            gasLimit,
          })
        })
        it('should update state', async function () {
          await vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
            gasLimit,
          })

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
      })
      describe('when shutdown', function () {
        beforeEach(async function () {
          await powerSwitch.connect(admin).emergencyShutdown()
        })
        it('should succeed', async function () {
          await vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
            gasLimit,
          })
        })
        it('should update state', async function () {
          await vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
            gasLimit,
          })

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
      })
      describe('with unknown vault', function () {
        it('should fail', async function () {
          await expect(
            geyser.connect(user).rageQuit({
              gasLimit,
            }),
          ).to.be.revertedWith('Aludel: no stake')
        })
      })
      describe('when no stake', function () {
        it('should fail', async function () {
          const secondVault = await createInstance('Crucible', vaultFactory, user)
          await expect(
            secondVault.connect(user).rageQuit(geyser.address, stakingToken.address, {
              gasLimit,
            }),
          ).to.be.revertedWith('Crucible: missing lock')
        })
      })
      describe('when insufficient gas', function () {
        it('should fail', async function () {
          await expect(
            vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
              gasLimit: await vault.RAGEQUIT_GAS(),
            }),
          ).to.be.revertedWith('Crucible: insufficient gas')
        })
      })
      describe('when insufficient gas with multiple stakes', function () {
        let quantity: number
        beforeEach(async function () {
          quantity = (await geyser.MAX_STAKES_PER_VAULT()).toNumber() - 1
          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)
          for (let index = 0; index < quantity; index++) {
            await stake(user, geyser, vault, stakingToken, stakeAmount.div(quantity))
          }
        })
        it('should fail', async function () {
          await expect(
            vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
              gasLimit: await vault.RAGEQUIT_GAS(),
            }),
          ).to.be.revertedWith('Crucible: insufficient gas')
        })
      })
      describe('when single stake', function () {
        it('should succeed', async function () {
          await vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
            gasLimit,
          })
        })
        it('should update state', async function () {
          await vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
            gasLimit,
          })

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
      })
      describe('when multiple stakes', function () {
        let quantity: number

        beforeEach(async function () {
          quantity = (await geyser.MAX_STAKES_PER_VAULT()).toNumber() - 1
          await stakingToken.connect(admin).transfer(vault.address, stakeAmount)
          for (let index = 0; index < quantity; index++) {
            await stake(user, geyser, vault, stakingToken, stakeAmount.div(quantity))
          }
        })
        it('should succeed', async function () {
          await vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
            gasLimit,
          })
        })
        it('should update state', async function () {
          await vault.connect(user).rageQuit(geyser.address, stakingToken.address, {
            gasLimit,
          })

          const geyserData = await geyser.getAludelData()
          const vaultData = await geyser.getVaultData(vault.address)

          expect(geyserData.rewardSharesOutstanding).to.eq(rewardAmount.mul(BASE_SHARES_PER_WEI))
          expect(geyserData.totalStake).to.eq(0)
          expect(geyserData.totalStakeUnits).to.eq(0)
          expect(geyserData.lastUpdate).to.eq(await getTimestamp())
          expect(vaultData.totalStake).to.eq(0)
          expect(vaultData.stakes.length).to.eq(0)
        })
      })
    })
  })
})
