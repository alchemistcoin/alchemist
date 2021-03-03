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

## Addresses

| Contract           | Address                                                                                                               | Description                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Alchemist          | [0x88acdd2a6425c3faae4bc9650fd7e27e0bebb7ab](https://etherscan.io/address/0x88acdd2a6425c3faae4bc9650fd7e27e0bebb7ab) | ERC20 token                                                                              |
| TokenManager       | [0x1c428a75181bc25509af3a5b7faee97b4b6d3562](https://etherscan.io/address/0x1c428a75181bc25509af3a5b7faee97b4b6d3562) | inflation recipient                                                                      |
| Crucible           | [0x18cc48140cFeC90CEF0035761D56d2d0ff3a110f](https://etherscan.io/address/0x18cc48140cFeC90CEF0035761D56d2d0ff3a110f) | crucible nft template                                                                    |
| CrucibleFactory    | [crucible.alchemistcoin.eth](https://etherscan.io/address/0x54e0395CFB4f39beF66DBCd5bD93Cca4E9273D56)                 | crucible nft factory                                                                     |
| PowerSwitchFactory | [0x89d2D92eaCE71977dD0b159062f8ec90EA64fc24](https://etherscan.io/address/0x89d2D92eaCE71977dD0b159062f8ec90EA64fc24) | factory contract                                                                         |
| RewardPoolFactory  | [0xF016fa84D5f3a252409a63b5cb89B555A0d27Ccf](https://etherscan.io/address/0xF016fa84D5f3a252409a63b5cb89B555A0d27Ccf) | factory contract                                                                         |
| UniswapV2Pair      | [0xCD6bcca48069f8588780dFA274960F15685aEe0e](https://etherscan.io/address/0xCD6bcca48069f8588780dFA274960F15685aEe0e) | [WETH-⚗️ pair](https://info.uniswap.org/pair/0xCD6bcca48069f8588780dFA274960F15685aEe0e) |
| Aludel             | [0xf0D415189949d913264A454F57f4279ad66cB24d](https://etherscan.io/address/0xf0D415189949d913264A454F57f4279ad66cB24d) | WETH-⚗️ uniswap reward program                                                           |
| TransmuterV1       | [0xB772ce9f14FC7C7db0D4525aDb9349FBD7ce456a](https://etherscan.io/address/0xB772ce9f14FC7C7db0D4525aDb9349FBD7ce456a) | router contract for batched transactions                                                 |

## Check system status

Check Alchemist system status.

```bash
Usage: hardhat [GLOBAL OPTIONS] status
```

## Mint Crucible and stake LP tokens in Aludel

Mint Crucible and lock in Aludel. See [tutorial](https://www.notion.so/alchemist-tutorial-5f4f3f5f8b7946f59b3eb1b41a42d129).

```bash
Usage: hardhat [GLOBAL OPTIONS] mint-and-lock --aludel <STRING> --amount <STRING> --crucible-factory <STRING> --transmuter <STRING>

OPTIONS:

  --aludel              Aludel reward contract
  --amount              Amount of staking tokens with decimals
  --crucible-factory    Crucible factory contract
  --transmuter          TransmuterV1 contract
```

## Unstake LP tokens, claim reward, and transfer

Unstake lp tokens, claim reward, and withdraw. Note: use the `--private` flag to avoid frontrunning bots.

```bash
Usage: hardhat [GLOBAL OPTIONS] unstake-claim-withdraw --aludel <STRING> --amount <STRING> --crucible <STRING> [--private] --recipient <STRING>

OPTIONS:

  --aludel      Aludel reward contract
  --amount      Amount of staking tokens with decimals
  --crucible    Crucible vault contract
  --private     Use taichi network to avoid frontrunners
  --recipient   Address to receive stake and reward
```
