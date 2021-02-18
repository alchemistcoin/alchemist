import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'

import './tasks/alchemist'
import './tasks/status'
import './tasks/crucible'
import './tasks/aludel'
import './tasks/uniswap'
import './tasks/mock'
import './tasks/transmuter'

import { Wallet } from 'ethers'
import { HardhatUserConfig } from 'hardhat/config'
import { parseUnits } from 'ethers/lib/utils'

export default {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      forking: {
        url: process.env.ETHEREUM_ARCHIVE_URL,
      },
      accounts: {
        mnemonic:
          process.env.DEV_MNEMONIC || Wallet.createRandom().mnemonic.phrase,
      },
    },
    goerli: {
      url: 'https://goerli.infura.io/v3/' + process.env.INFURA_ID,
      accounts: {
        mnemonic:
          process.env.DEV_MNEMONIC || Wallet.createRandom().mnemonic.phrase,
      },
    },
    mainnet: {
      url: 'https://mainnet.infura.io/v3/' + process.env.INFURA_ID,
      accounts: {
        mnemonic:
          process.env.DEV_MNEMONIC || Wallet.createRandom().mnemonic.phrase,
      },
      gasPrice: parseUnits('130', 'gwei').toNumber(),
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_APIKEY,
  },
} as HardhatUserConfig
