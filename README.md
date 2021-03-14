# alchemist ⚗️

Introducing Alchemist Coin ⚗️

⚗️'s one and only purpose is to find the philosopher's stone and use it to explore the galaxy.

Can a meme coin help us achieve immortality?

Only one way to find out...

[alchemistcoin.eth](https://etherscan.io/token/0x88acdd2a6425c3faae4bc9650fd7e27e0bebb7ab)

Facts 🧝🏽‍♀️

- initial distribution through @BalancerLabs LBP
- funds raised are sent to ecosystem incentive program
- has configurable inflation initially set to 1% every 14 days

Usage 🧪

- the only plan is that there is no plan
- this token can be used for anything and everything, and maybe even nothing
- inflation may be used for composability and coordination experiments, but maybe not, who know

Long Term 🪐

- find the philosopher's stone
- cure aging
- solve fusion
- explore the galaxy

u in ?

## Community

Voting: https://cast.alchemist.wtf/  
Discord: http://discord.alchemist.wtf/  
FAQ: https://hackmd.io/@thegostep/⚗️  
Community-github: https://github.com/alchemist-community  
Community-frontend: https://alchemist.farm  

## Addresses

The Crucible NFT and Aludel LP reward contracts are forks of [Ampleforth](https://github.com/ampleforth)'s upcoming token geyser v2 and UniversalVault NFT contracts. This is a test in prod. *Use at your own risk.*

| Contract           | Address                                                                                                               | Description                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Alchemist          | [alchemistcoin.eth](https://etherscan.io/address/alchemistcoin.eth)                                                   | ERC20 token                                                                                      |
| Crucible NFT       | [crucible.alchemistcoin.eth](https://etherscan.io/address/crucible.alchemistcoin.eth)                                 | crucible nft contract                                                                            |
| Aludel             | [aludel.alchemistcoin.eth](https://etherscan.io/address/aludel.alchemistcoin.eth)                                     | ⚗️/WETH uniswap LP reward program                                                                |
| UniswapV2Pair      | [uniswap.alchemistcoin.eth](https://etherscan.io/address/uniswap.alchemistcoin.eth)                                   | [⚗️/WETH uniswap pair](https://info.uniswap.org/pair/0xCD6bcca48069f8588780dFA274960F15685aEe0e) |
| TransmuterV1       | [transmuter.alchemistcoin.eth](https://etherscan.io/address/transmuter.alchemistcoin.eth)                             | router contract for batched transactions                                                         |
| TokenManager       | [0x1c428a75181bc25509af3a5b7faee97b4b6d3562](https://etherscan.io/address/0x1c428a75181bc25509af3a5b7faee97b4b6d3562) | inflation recipient                                                                              |
| Crucible Template  | [0x18cc48140cFeC90CEF0035761D56d2d0ff3a110f](https://etherscan.io/address/0x18cc48140cFeC90CEF0035761D56d2d0ff3a110f) | crucible nft template                                                                            |
| PowerSwitchFactory | [0x89d2D92eaCE71977dD0b159062f8ec90EA64fc24](https://etherscan.io/address/0x89d2D92eaCE71977dD0b159062f8ec90EA64fc24) | factory contract                                                                                 |
| RewardPoolFactory  | [0xF016fa84D5f3a252409a63b5cb89B555A0d27Ccf](https://etherscan.io/address/0xF016fa84D5f3a252409a63b5cb89B555A0d27Ccf) | factory contract                                                                                 |

## Check system status

Check Alchemist system status.

```bash
Usage: hardhat [GLOBAL OPTIONS] status
```

## Mint Crucible and stake LP tokens in Aludel

See [tutorial](https://www.notion.so/alchemist-tutorial-5f4f3f5f8b7946f59b3eb1b41a42d129).

```bash
Usage: hardhat [GLOBAL OPTIONS] mint-and-lock --aludel <STRING> --amount <STRING> --crucible-factory <STRING> --transmuter <STRING>

OPTIONS:

  --aludel              Aludel reward contract
  --amount              Amount of staking tokens with decimals
  --crucible-factory    Crucible factory contract
  --transmuter          TransmuterV1 contract
```

## Unstake LP tokens and claim reward from aludel

Note: use the `--private` flag to avoid frontrunning bots.

```bash
Usage: hardhat [GLOBAL OPTIONS] unstake-and-claim --aludel <STRING> --amount <STRING> --crucible <STRING> [--private] --recipient <STRING>

OPTIONS:

  --aludel      Aludel reward contract
  --amount      Amount of staking tokens with decimals
  --crucible    Crucible vault contract
  --private     Use taichi network to avoid frontrunners
  --recipient   Address to receive stake and reward
```

## Withdraw ERC20 token from crucible

```bash
Usage: hardhat [GLOBAL OPTIONS] crucible-withdraw --amount <STRING> --crucible <STRING> --recipient <STRING> --token <STRING>

OPTIONS:

  --amount      Amount of staking tokens with decimals
  --crucible    Crucible vault contract
  --recipient   Address to receive stake and reward
  --token       Token contract
```
