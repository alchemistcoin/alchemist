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
FAQ: https://docs.alchemist.wtf/mist/  
GitHub: https://github.com/alchemistcoin/crucible-frontend  
Crucible/Aludel Rewards: https://crucible.alchemist.wtf  
MistX FlashDEX: https://mistx.io/
Copper Fair Launch: https://copperlaunch.com/

## Addresses

The Crucible NFT and Aludel LP reward contracts are forks of [Ampleforth](https://github.com/ampleforth)'s upcoming token geyser v2 and UniversalVault NFT contracts. This is a test in prod. _Use at your own risk._

| Contract           | Address                                                                                                               | Description                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Alchemist          | [alchemistcoin.eth](https://etherscan.io/address/alchemistcoin.eth)                                                   | ERC20 token                                                                                      |
| Crucible NFT       | [crucible.alchemistcoin.eth](https://etherscan.io/address/crucible.alchemistcoin.eth)                                 | crucible nft contract                                                                            |
| Aludel v1             | [aludel.alchemistcoin.eth](https://etherscan.io/address/aludel.alchemistcoin.eth)                                     | ⚗️/WETH LP (Uniswap v2) reward program                                                                |
| Aludel v1.5             | [0x93c31fc68E613f9A89114f10B38F9fd2EA5de6BC](https://etherscan.io/address/0x93c31fc68E613f9A89114f10B38F9fd2EA5de6BC)                                     | ⚗️/WETH LP (Uniswap v2) reward program                                                                |
| Multisig           | [multisig.alchemistcoin.eth](https://etherscan.io/address/multisig.alchemistcoin.eth)                                 | community multisig                                                                               |
| UniswapV2Pair      | [uniswap.alchemistcoin.eth](https://etherscan.io/address/uniswap.alchemistcoin.eth)                                   | [⚗️/WETH uniswap pair](https://info.uniswap.org/pair/0xCD6bcca48069f8588780dFA274960F15685aEe0e) |
| TransmuterV1       | [transmuter.alchemistcoin.eth](https://etherscan.io/address/transmuter.alchemistcoin.eth)                             | router contract for batched transactions                                                         |
| StreamV1           | [0x979e2FdE487534be3f8a41cD57f11EF9E71cDC1A](https://etherscan.io/address/0x979e2FdE487534be3f8a41cD57f11EF9E71cDC1A) | inflation streaming                                                                              |
| TokenManager       | [0x1c428a75181bc25509af3a5b7faee97b4b6d3562](https://etherscan.io/address/0x1c428a75181bc25509af3a5b7faee97b4b6d3562) | treasury                                                                                         |
| Crucible Template  | [0x18cc48140cFeC90CEF0035761D56d2d0ff3a110f](https://etherscan.io/address/0x18cc48140cFeC90CEF0035761D56d2d0ff3a110f) | crucible nft template                                                                            |
| PowerSwitchFactory | [0x89d2D92eaCE71977dD0b159062f8ec90EA64fc24](https://etherscan.io/address/0x89d2D92eaCE71977dD0b159062f8ec90EA64fc24) | factory contract                                                                                 |
| RewardPoolFactory  | [0xF016fa84D5f3a252409a63b5cb89B555A0d27Ccf](https://etherscan.io/address/0xF016fa84D5f3a252409a63b5cb89B555A0d27Ccf) | factory contract                                                                                 |
| mistX Tip Jar  | [mistx.eth](https://etherscan.io/address/mistx.eth) | mistX tip jar                                                                                 |
| MistXRouter  | [0xA58f22e0766B3764376c92915BA545d583c19DBc](https://etherscan.io/address/0xA58f22e0766B3764376c92915BA545d583c19DBc) | mistX transaction router                                                                                 |

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
