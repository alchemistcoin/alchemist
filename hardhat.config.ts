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
import './tasks/wallet'

import { HardhatUserConfig } from 'hardhat/config'
import { parseUnits } from 'ethers/lib/utils'

require('dotenv').config()

const mnemonic = process.env.DEV_MNEMONIC || ''
const archive_node = process.env.ETHEREUM_ARCHIVE_URL || ''

export default {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      forking: {
        url: archive_node,
      },
      accounts: {
        mnemonic,
      },
    },
    goerli: {
      url: 'https://goerli.infura.io/v3/' + process.env.INFURA_ID,
      accounts: {
        mnemonic,
      },
    },
    mainnet: {
      url: 'https://mainnet.infura.io/v3/' + process.env.INFURA_ID,
      accounts: {
        mnemonic,
      },
      gasPrice: parseUnits('130', 'gwei').toNumber(),
    },
    alchemist: {
      url: 'https://cloudflare-eth.com/',
      accounts: {
        mnemonic,
      },
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
