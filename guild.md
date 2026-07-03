# Signature Airdrop 项目开发与部署指南

> 文件名按需求保留为 `guild.md`。本指南基于当前仓库真实代码、配置文件和脚本编写，目标是让新开发者可以从 0 到 1 复现这个签名空投项目的开发、测试、部署和上线流程。

## 1. 项目概览

Signature Airdrop 是一个部署在 Base Sepolia 测试网的 ECDSA 签名空投 Demo。它由三部分组成：

| 模块 | 路径 | 技术栈 | 作用 |
| --- | --- | --- | --- |
| 智能合约 | `contracts/` | Foundry、Solidity 0.8.24、OpenZeppelin | 管理空投轮次、校验后端签名、发放 ERC20 或 ERC721 奖励 |
| 后端服务 | `backend/` | Nest.js、TypeScript、ethers v6 | 读取白名单、校验资格、生成链上 claim 所需签名 |
| 前端应用 | `frontend/` | Vite、React 19、TypeScript、wagmi、RainbowKit | 连接钱包、查询资格、请求签名、调用合约领取奖励 |

核心流程：

1. 合约 Owner 部署 `SignatureAirdrop`、测试 ERC20、测试 ERC721。
2. 部署脚本配置两个空投轮次：
   - Round 1：ERC20 奖励。
   - Round 2：ERC721 奖励。
3. 后端读取 `backend/whitelist.json`，判断用户地址是否在某个 round 的白名单里。
4. 用户前端连接钱包后，先调用后端 `/api/eligibility` 查询资格。
5. 用户点击领取时，前端调用后端 `/api/sign` 拿到 ECDSA 签名。
6. 前端把 `round`、`amountOrTokenId`、`nonce`、`signature` 传给链上 `claim()`。
7. 合约恢复签名者地址，确认签名者等于部署时配置的 `signer`，然后发放 ERC20 或 mint ERC721。

## 2. 代码结构

```text
signature-airdrop/
├── README.md
├── guild.md
├── .env.example
├── render.yaml
├── contracts/
│   ├── foundry.toml
│   ├── .env.example
│   ├── src/
│   │   ├── Airdrop.sol
│   │   ├── AirdropToken.sol
│   │   └── AirdropNFT.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── test/
│       └── Airdrop.t.sol
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── whitelist.json
│   └── src/
│       ├── main.ts
│       ├── sign/
│       │   ├── sign.controller.ts
│       │   └── sign.service.ts
│       └── whitelist/
│           └── whitelist.service.ts
└── frontend/
    ├── package.json
    ├── .env.example
    ├── .env.local.example
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── components/
        │   ├── Header.tsx
        │   └── ClaimPanel.tsx
        ├── config/
        │   └── Web3Provider.tsx
        ├── hooks/
        │   └── useAirdrop.ts
        └── abi/
            └── airdrop.ts
```

## 3. 开发前准备

### 3.1 必备工具

| 工具 | 用途 | 检查命令 |
| --- | --- | --- |
| Node.js 22 | 运行 Nest.js 后端和 Vite 前端 | `node -v` |
| npm | 安装 JS/TS 依赖 | `npm -v` |
| Foundry | 编译、测试、部署 Solidity 合约 | `forge --version`、`cast --version` |
| Git | 版本管理 | `git --version` |
| Base Sepolia ETH | 支付部署和 claim 测试 gas | 钱包或区块浏览器查看余额 |
| Etherscan API V2 Key | 可选，用于合约验证 | https://etherscan.io/myapikey |
| WalletConnect Project ID | 可选，用于 RainbowKit 钱包连接 | https://cloud.walletconnect.com/ |

### 3.2 安装 Foundry

如果本机还没有 Foundry：

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge --version
```

### 3.3 克隆仓库并进入项目

```bash
git clone <你的仓库地址> signature-airdrop
cd signature-airdrop
```

## 4. 第一步：理解签名安全模型

合约和后端必须对同一份消息进行签名/验签。当前项目的签名消息是：

```solidity
keccak256(abi.encodePacked(
  recipient,
  round,
  amountOrTokenId,
  nonce,
  address(this),
  block.chainid
))
```

各字段作用如下：

| 字段 | 作用 |
| --- | --- |
| `recipient` | 绑定领取人，防止 A 用户拿 B 用户签名领取 |
| `round` | 绑定空投轮次，防止跨轮次复用签名 |
| `amountOrTokenId` | 对 ERC20 表示数量；对 ERC721 表示白名单记录中的奖励占位值 |
| `nonce` | 后端按 round 和名单顺序生成，增强唯一性 |
| `address(this)` | 绑定当前空投合约，防止跨合约重放 |
| `block.chainid` | 绑定链 ID，防止跨链重放 |

链上合约还记录：

```solidity
mapping(uint256 => mapping(uint8 => mapping(address => bool))) public claimed;
```

所以同一个用户在同一个 round、同一种 token type 下只能领取一次。

## 5. 第二步：开发和测试智能合约

### 5.1 安装合约依赖

`contracts/lib/` 被 git 忽略，克隆后需要重新安装依赖：

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
```

### 5.2 合约文件职责

| 文件 | 职责 |
| --- | --- |
| `contracts/src/Airdrop.sol` | 主空投合约，负责轮次配置、签名校验、领取状态记录、发放奖励 |
| `contracts/src/AirdropToken.sol` | Demo ERC20 token，用于 Round 1 奖励 |
| `contracts/src/AirdropNFT.sol` | Demo ERC721 NFT，用于 Round 2 奖励 |
| `contracts/script/Deploy.s.sol` | 一次性部署空投合约、ERC20、ERC721，并配置轮次 |
| `contracts/test/Airdrop.t.sol` | Foundry 测试用例 |

### 5.3 主合约关键接口

| 函数 | 调用者 | 作用 |
| --- | --- | --- |
| `constructor(address initialOwner, address initialSigner)` | 部署脚本 | 设置合约 Owner 和后端签名者地址 |
| `setSigner(address newSigner)` | Owner | 更换后端签名者 |
| `configureRound(uint256 round, address token, TokenType tokenType, bool active, uint256 nextTokenId)` | Owner | 配置某一轮奖励 token、类型、是否开启、NFT 起始 tokenId |
| `setRoundActive(uint256 round, bool active)` | Owner | 开关某一轮空投 |
| `setCurrentRound(uint256 round)` | Owner | 设置当前轮次标记 |
| `pause()` / `unpause()` | Owner | 紧急暂停/恢复 claim |
| `claim(uint256 round, uint256 amountOrTokenId, uint256 nonce, bytes signature)` | 用户 | 提交后端签名并领取奖励 |

### 5.4 本地运行合约测试

```bash
cd contracts
forge test -vv
```

当前 README 记录的本地验证结果是：`forge test -vv` 通过 7/7 个 airdrop 测试。

## 6. 第三步：准备部署环境变量

项目根目录有 `.env.example` 作为总览说明，但实际运行时每个子项目使用自己的 env 文件。

### 6.1 合约环境变量

```bash
cp contracts/.env.example contracts/.env
```

编辑 `contracts/.env`：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `BASE_SEPOLIA_RPC_URL` | 是 | Base Sepolia RPC，默认可用 `https://sepolia.base.org`，正式演示建议换成私有 RPC |
| `PRIVATE_KEY` | 是 | 部署者私钥，支付 gas，并成为合约 Owner |
| `SIGNER_ADDRESS` | 是 | 后端签名私钥对应的钱包地址，必须和 `backend/.env` 的 `SIGNER_PRIVATE_KEY` 匹配 |
| `BASESCAN_API_KEY` | 否 | Etherscan API V2 key，用于验证合约 |
| `VERIFIER_URL` | 否 | Base Sepolia 的 Etherscan V2 verifier URL，当前是 `https://api.etherscan.io/v2/api?chainid=84532` |

注意：

- 不要把真实 `.env` 提交到 Git。
- `PRIVATE_KEY` 是部署者，`SIGNER_PRIVATE_KEY` 是后端签名者。Demo 可以用同一个账号，但生产环境建议分开。
- 部署者需要有 Base Sepolia ETH。

### 6.2 后端环境变量

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `PORT` | 是 | 后端监听端口，默认 `4000` |
| `CHAIN_ID` | 是 | Base Sepolia 是 `84532` |
| `RPC_URL` | 是 | 后端查询链上 claimed 状态使用的 RPC |
| `AIRDROP_CONTRACT_ADDRESS` | 是 | 部署完成后的 `SignatureAirdrop` 地址 |
| `SIGNER_PRIVATE_KEY` | 是 | 后端签名私钥，公钥地址必须等于合约构造参数 `SIGNER_ADDRESS` |
| `WHITELIST_PATH` | 是 | 白名单文件路径，当前为 `./whitelist.json` |
| `CORS_ORIGIN` | 是 | 允许访问后端的前端域名，多个用英文逗号分隔；本地 `localhost`/`127.0.0.1` 任意端口会自动放行 |

### 6.3 前端环境变量

本地建议使用 `.env.local`：

```bash
cp frontend/.env.local.example frontend/.env.local
```

编辑 `frontend/.env.local`：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 是 | 后端 API 地址，本地默认 `http://localhost:4000/api` |
| `VITE_AIRDROP_CONTRACT_ADDRESS` | 是 | 部署完成后的 `SignatureAirdrop` 地址 |
| `VITE_WALLETCONNECT_PROJECT_ID` | 否 | RainbowKit/WalletConnect 项目 ID；未配置时代码会使用 `demo-project-id` |

Vite 只会把 `VITE_` 前缀变量暴露给浏览器，不要把私钥放进前端 env。

## 7. 第四步：部署智能合约到 Base Sepolia

### 7.1 加载合约 env

```bash
cd contracts
set -a
source .env
set +a
```

### 7.2 只部署不验证

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

部署脚本会执行 7 个步骤：

1. 部署 `SignatureAirdrop`。
2. 部署 ERC20 测试 token `AirdropToken`。
3. 部署 ERC721 测试 NFT `AirdropNFT`。
4. 给空投合约 mint `1_000_000 ether` 的 ERC20 奖励池。
5. 把 NFT 合约 owner 转给空投合约，让空投合约可以 mint NFT。
6. 配置 Round 1 为 ERC20，Round 2 为 ERC721。
7. 设置 `currentRound = 1`。

脚本最后会打印三类地址：

```text
SIGNATURE_AIRDROP_ADDRESS=<空投合约地址>
AIRDROP_TOKEN_ADDRESS=<ERC20 地址>
AIRDROP_NFT_ADDRESS=<ERC721 地址>
```

### 7.3 部署并验证合约

如果已经配置 `BASESCAN_API_KEY`，可以部署时直接验证：

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  --verifier etherscan \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=84532" \
  --etherscan-api-key "$BASESCAN_API_KEY" \
  -vvvv
```

### 7.4 部署成功但验证失败时手动验证

`SignatureAirdrop` 构造参数是 `owner` 和 `signer`：

```bash
forge verify-contract \
  --chain 84532 \
  --watch \
  --verifier etherscan \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=84532" \
  --etherscan-api-key "$BASESCAN_API_KEY" \
  --constructor-args $(cast abi-encode "constructor(address,address)" "$OWNER_ADDRESS" "$SIGNER_ADDRESS") \
  <SIGNATURE_AIRDROP_ADDRESS> \
  src/Airdrop.sol:SignatureAirdrop
```

`OWNER_ADDRESS` 应该是 `PRIVATE_KEY` 对应的钱包地址。可以用下面命令确认：

```bash
cast wallet address --private-key "$PRIVATE_KEY"
```

## 8. 第五步：同步部署地址

合约部署完成后，至少需要同步 `SignatureAirdrop` 地址。

### 8.1 更新后端

`backend/.env`：

```bash
AIRDROP_CONTRACT_ADDRESS=<SIGNATURE_AIRDROP_ADDRESS>
```

### 8.2 更新前端

`frontend/.env.local`：

```bash
VITE_AIRDROP_CONTRACT_ADDRESS=<SIGNATURE_AIRDROP_ADDRESS>
```

### 8.3 可选：更新白名单 token 字段

`backend/whitelist.json` 里每个 round 有一个 `token` 字段。目前后端实际签名逻辑主要使用 `tokenType` 和 `recipients`，但为了文档一致性和后续扩展，建议把部署脚本输出的 token 地址同步进去：

```json
{
  "1": {
    "tokenType": "ERC20",
    "token": "<AIRDROP_TOKEN_ADDRESS>",
    "recipients": {}
  },
  "2": {
    "tokenType": "ERC721",
    "token": "<AIRDROP_NFT_ADDRESS>",
    "recipients": {}
  }
}
```

不要删除实际白名单地址；上面只是字段结构示例。

## 9. 第六步：开发和运行后端

### 9.1 安装依赖

```bash
cd backend
npm ci
```

如果没有 lockfile 才使用：

```bash
npm install
```

### 9.2 白名单数据格式

当前白名单文件是 `backend/whitelist.json`，结构如下：

```json
{
  "1": {
    "tokenType": "ERC20",
    "token": "0x...",
    "recipients": {
      "0x用户地址": "100000000000000000000"
    }
  },
  "2": {
    "tokenType": "ERC721",
    "token": "0x...",
    "recipients": {
      "0x用户地址": "1"
    }
  }
}
```

后端启动时 `WhitelistService` 会读取此文件，并为每条记录生成：

```text
key = normalizedAddress.toLowerCase() + ':' + round
nonce = round * 1_000_000 + index
```

因此，如果你调整白名单顺序，nonce 也会变化。已经发出去的签名不应在领取前随意改变对应记录。

### 9.3 启动开发服务器

```bash
cd backend
npm run dev
```

默认监听：

```text
http://localhost:4000/api
```

### 9.4 后端 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 查看服务状态、签名者地址、chainId、合约地址 |
| `GET` | `/api/eligibility?address=0x...&round=1` | 查询某地址某轮是否有资格、是否已领取 |
| `POST` | `/api/sign` | 对白名单用户生成 claim 签名 |

`POST /api/sign` 请求体：

```json
{
  "address": "0x用户地址",
  "round": 1
}
```

返回示例字段：

```json
{
  "eligible": true,
  "round": 1,
  "tokenType": "ERC20",
  "amountOrTokenId": "100000000000000000000",
  "nonce": 1000000,
  "signature": "0x...",
  "contractAddress": "0x...",
  "chainId": "84532"
}
```

### 9.5 后端构建检查

```bash
cd backend
npm run build
```

## 10. 第七步：开发和运行前端

### 10.1 安装依赖

```bash
cd frontend
npm ci
```

### 10.2 启动开发服务器

```bash
cd frontend
npm run dev
```

默认 Vite 地址通常是：

```text
http://localhost:5173
```

如果 5173 被占用，Vite 可能自动使用 5174 等其他端口。后端 CORS 代码会自动允许 `localhost` 和 `127.0.0.1` 的任意端口。

### 10.3 前端页面流程

1. RainbowKit 连接钱包。
2. `ClaimPanel` 选择 round：Round 1 ERC20 或 Round 2 ERC721。
3. 点击查询资格，前端调用：

```text
GET ${VITE_API_BASE_URL}/eligibility?address=<wallet>&round=<round>
```

4. 点击领取，前端调用：

```text
POST ${VITE_API_BASE_URL}/sign
```

5. 前端使用后端返回的签名调用合约：

```text
claim(round, amountOrTokenId, nonce, signature)
```

6. wagmi 等待交易回执，成功后页面显示领取确认。

### 10.4 前端构建检查

```bash
cd frontend
npm run build
```

构建输出目录是：

```text
frontend/dist/
```

## 11. 第八步：本地端到端联调

推荐顺序：

### 11.1 确认合约已部署

你需要已经拿到：

```text
SIGNATURE_AIRDROP_ADDRESS
AIRDROP_TOKEN_ADDRESS
AIRDROP_NFT_ADDRESS
```

并且：

- `backend/.env` 已配置 `AIRDROP_CONTRACT_ADDRESS`。
- `frontend/.env.local` 已配置 `VITE_AIRDROP_CONTRACT_ADDRESS`。
- `backend/.env` 的 `SIGNER_PRIVATE_KEY` 对应地址等于合约 `signer()`。

### 11.2 启动后端

```bash
cd backend
npm run dev
```

### 11.3 检查 health

```bash
curl http://localhost:4000/api/health
```

重点检查：

- `ok` 是否为 `true`。
- `chainId` 是否为 `84532`。
- `contractAddress` 是否为真实部署地址，而不是 `0x0000000000000000000000000000000000000000`。
- `signer` 是否等于合约部署时的 `SIGNER_ADDRESS`。

### 11.4 查询白名单地址资格

使用 `backend/whitelist.json` 中的一个地址：

```bash
curl "http://localhost:4000/api/eligibility?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266&round=1"
```

### 11.5 请求签名

```bash
curl -X POST http://localhost:4000/api/sign \
  -H "Content-Type: application/json" \
  -d '{"address":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","round":1}'
```

如果返回签名，说明后端和合约地址配置基本正确。

### 11.6 启动前端并领取

```bash
cd frontend
npm run dev
```

浏览器打开 Vite 地址，连接钱包并切到 Base Sepolia。使用白名单里的地址测试领取。

注意：仓库里的默认白名单包含多条 Anvil 风格 demo 地址，这些地址未必是你浏览器钱包当前账户。真实演示前需要把你自己的测试钱包地址加入 `backend/whitelist.json`，并重启后端。

## 12. 第九步：部署后端到 Render

仓库根目录已有 `render.yaml`，配置如下：

| Render 配置项 | 当前值 |
| --- | --- |
| service name | `signature-airdrop-backend` |
| runtime | `node` |
| rootDir | `backend` |
| region | `oregon` |
| buildCommand | `npm ci && npm run build` |
| startCommand | `npm run start` |
| healthCheckPath | `/api/health` |
| NODE_VERSION | `22` |
| PORT | `4000` |
| CHAIN_ID | `84532` |
| RPC_URL | `https://sepolia.base.org` |
| WHITELIST_PATH | `./whitelist.json` |

### 12.1 Render Blueprint 部署

1. 登录 Render。
2. 选择 New + Blueprint。
3. 绑定当前 GitHub 仓库。
4. Render 会读取根目录 `render.yaml`。
5. 填写 `sync: false` 的敏感变量：
   - `AIRDROP_CONTRACT_ADDRESS`
   - `SIGNER_PRIVATE_KEY`
6. 确认 `CORS_ORIGIN` 包含你的 Vercel 前端正式域名。
7. 部署。

### 12.2 Render 环境变量检查

Render 后台至少需要：

```text
NODE_VERSION=22
PORT=4000
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org
WHITELIST_PATH=./whitelist.json
CORS_ORIGIN=https://你的前端域名
AIRDROP_CONTRACT_ADDRESS=0x...
SIGNER_PRIVATE_KEY=0x...
```

### 12.3 Render 部署后验证

假设后端域名是：

```text
https://signature-airdrop-backend.onrender.com
```

验证 health：

```bash
curl https://signature-airdrop-backend.onrender.com/api/health
```

验证 eligibility：

```bash
curl "https://signature-airdrop-backend.onrender.com/api/eligibility?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266&round=1"
```

如果浏览器前端访问时报 CORS 错误，就把当前前端域名追加到 Render 的 `CORS_ORIGIN`，多个域名用英文逗号分隔。

## 13. 第十步：部署前端到 Vercel

前端是标准 Vite 静态应用，部署目录是 `frontend/`。

### 13.1 Vercel 项目设置

在 Vercel 创建项目时：

| 配置项 | 值 |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `frontend` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

### 13.2 Vercel 环境变量

在 Vercel 项目 Settings -> Environment Variables 中配置：

```text
VITE_API_BASE_URL=https://你的-render-backend-domain/api
VITE_AIRDROP_CONTRACT_ADDRESS=0x你的SignatureAirdrop地址
VITE_WALLETCONNECT_PROJECT_ID=你的WalletConnect项目ID
```

然后重新部署前端。

### 13.3 前端部署后检查

1. 打开 Vercel 域名。
2. 连接钱包。
3. 确认网络是 Base Sepolia。
4. 点击查询资格。
5. 如果资格查询失败：
   - 检查 `VITE_API_BASE_URL` 是否以 `/api` 结尾。
   - 检查 Render 后端是否正常。
   - 检查 Render `CORS_ORIGIN` 是否包含当前 Vercel 域名。
6. 如果签名成功但链上 claim 失败：
   - 检查前端 `VITE_AIRDROP_CONTRACT_ADDRESS` 和后端 `AIRDROP_CONTRACT_ADDRESS` 是否完全一致。
   - 检查后端 signer 是否等于合约 `signer()`。
   - 检查钱包是否是白名单地址。
   - 检查该地址是否已经领取。

## 14. 第十一步：常用运维命令

### 14.1 查询合约 signer

```bash
cast call <SIGNATURE_AIRDROP_ADDRESS> "signer()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

### 14.2 查询当前 round

```bash
cast call <SIGNATURE_AIRDROP_ADDRESS> "currentRound()(uint256)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

### 14.3 查询某用户是否已领取

Round 1 ERC20 的 tokenType 是 `0`，Round 2 ERC721 的 tokenType 是 `1`：

```bash
cast call <SIGNATURE_AIRDROP_ADDRESS> \
  "claimed(uint256,uint8,address)(bool)" \
  1 0 <USER_ADDRESS> \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

### 14.4 暂停 claim

```bash
cast send <SIGNATURE_AIRDROP_ADDRESS> \
  "pause()" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

### 14.5 恢复 claim

```bash
cast send <SIGNATURE_AIRDROP_ADDRESS> \
  "unpause()" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

### 14.6 更换后端 signer

先准备新 signer 私钥，并得到新地址：

```bash
cast wallet address --private-key "$NEW_SIGNER_PRIVATE_KEY"
```

链上更新 signer：

```bash
cast send <SIGNATURE_AIRDROP_ADDRESS> \
  "setSigner(address)" \
  <NEW_SIGNER_ADDRESS> \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

然后更新 Render 或本地 `backend/.env`：

```text
SIGNER_PRIVATE_KEY=<NEW_SIGNER_PRIVATE_KEY>
```

重启后端，并检查：

```bash
curl https://你的后端域名/api/health
```

## 15. 第十二步：新增一轮空投

### 15.1 链上配置新 round

如果复用已有 ERC20 或 ERC721 合约，可以直接调用 `configureRound`。

ERC20 示例，tokenType 为 `0`：

```bash
cast send <SIGNATURE_AIRDROP_ADDRESS> \
  "configureRound(uint256,address,uint8,bool,uint256)" \
  3 <ERC20_TOKEN_ADDRESS> 0 true 0 \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

ERC721 示例，tokenType 为 `1`，从 tokenId 100 开始 mint：

```bash
cast send <SIGNATURE_AIRDROP_ADDRESS> \
  "configureRound(uint256,address,uint8,bool,uint256)" \
  4 <ERC721_TOKEN_ADDRESS> 1 true 100 \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

### 15.2 更新后端白名单

在 `backend/whitelist.json` 增加新的 round：

```json
{
  "3": {
    "tokenType": "ERC20",
    "token": "0x...",
    "recipients": {
      "0x用户地址": "100000000000000000000"
    }
  }
}
```

重新部署或重启后端，让 `WhitelistService` 重新加载白名单。

### 15.3 更新前端 round 选择器

当前前端 `frontend/src/components/ClaimPanel.tsx` 写死了 Round 1 和 Round 2：

```tsx
<option value={1}>...</option>
<option value={2}>...</option>
```

如果新增 Round 3，需要扩展这里的选项，以及 `frontend/src/i18n.tsx` 中对应文案。

## 16. 第十三步：完整验证清单

每次发版前建议按顺序执行：

```bash
cd contracts
forge test -vv
```

```bash
cd backend
npm ci
npm run build
```

```bash
cd frontend
npm ci
npm run build
```

部署后再执行：

```bash
curl https://你的后端域名/api/health
```

```bash
curl "https://你的后端域名/api/eligibility?address=<白名单地址>&round=1"
```

最后用浏览器真实钱包完成一次：

1. 打开前端。
2. 连接白名单钱包。
3. 查询资格。
4. 请求领取。
5. 钱包确认交易。
6. 在 Base Sepolia 浏览器查看交易成功。
7. 再次查询资格，确认 `claimed=true`。

## 17. 常见问题排查

### 17.1 后端启动时报 `SIGNER_PRIVATE_KEY must be configured`

原因：`backend/.env` 没有配置真实 `SIGNER_PRIVATE_KEY`，或者还在使用全 0 占位值。

解决：填入真实后端签名私钥，重启后端。

### 17.2 `/api/sign` 返回 `AIRDROP_CONTRACT_ADDRESS is not configured`

原因：后端 `AIRDROP_CONTRACT_ADDRESS` 仍是零地址。

解决：把部署脚本输出的 `SIGNATURE_AIRDROP_ADDRESS` 写入 `backend/.env` 或 Render 环境变量。

### 17.3 前端提示合约地址未配置

原因：`VITE_AIRDROP_CONTRACT_ADDRESS` 未配置，或者仍是零地址。

解决：更新 `frontend/.env.local` 或 Vercel 环境变量后，重启/重新部署前端。

### 17.4 浏览器 CORS 报错

原因：后端 `CORS_ORIGIN` 没有包含当前前端域名。

解决：Render 后端环境变量追加前端域名，例如：

```text
CORS_ORIGIN=https://your-app.vercel.app,https://your-preview.vercel.app
```

本地 `localhost` 和 `127.0.0.1` 任意端口已在代码里自动放行。

### 17.5 用户不符合资格

可能原因：

- 当前钱包地址不在 `backend/whitelist.json`。
- 查询的 round 不对。
- 地址大小写不影响匹配，后端会 normalize，但地址本身必须正确。
- Render 部署后使用的是仓库中的旧白名单，修改后需要重新部署。

### 17.6 签名成功但 claim 失败

按优先级检查：

1. 前端、后端是否使用同一个 `AIRDROP_CONTRACT_ADDRESS`。
2. 后端 signer 地址是否等于链上 `signer()`。
3. `CHAIN_ID` 是否是 `84532`。
4. 钱包是否在 Base Sepolia 网络。
5. 当前 round 是否 active。
6. 该地址是否已经领取过。
7. ERC20 奖励池余额是否足够。
8. ERC721 合约 owner 是否已经转给空投合约。

### 17.7 合约验证失败

当前项目使用 Etherscan API V2，Base Sepolia verifier URL 是：

```text
https://api.etherscan.io/v2/api?chainid=84532
```

不要使用旧的 BaseScan V1 endpoint `https://api-sepolia.basescan.org/api`。

## 18. 安全注意事项

- 不要提交任何 `.env`、私钥或真实 RPC token。
- 生产环境不要让 deployer 私钥和后端 signer 私钥长期相同。
- 后端 signer 只能签白名单授权，不应该拥有合约 Owner 权限。
- `pause()` 是紧急刹车，发现签名泄露或白名单错误时应立即暂停。
- 修改 `backend/whitelist.json` 会影响后续签名的 nonce，正式活动中要避免随意重排名单。
- 前端环境变量会暴露给浏览器，只能放公开信息。
- Render/Vercel 的环境变量修改后需要重新部署或重启服务才会生效。

## 19. 推荐开发顺序总结

从零开发这个项目，可以按以下路线推进：

1. 先写合约数据模型：round、token type、claimed 状态。
2. 再写签名 hash：绑定用户、轮次、数量/TokenId、nonce、合约地址、chainId。
3. 写 `claim()`，完成 ERC20 transfer 和 ERC721 mint 两条分支。
4. 写 Foundry 测试，覆盖成功领取、重复领取、错误签名、错误轮次等情况。
5. 写部署脚本，一次性部署空投合约、ERC20、ERC721，并配置 round。
6. 写后端白名单 loader，把 JSON 变成可查询的 entry map。
7. 写后端 `/eligibility` 和 `/sign`。
8. 写前端钱包连接、资格查询和 claim 调用。
9. 本地跑通 `forge test`、后端 build、前端 build。
10. 部署合约到 Base Sepolia。
11. 把合约地址同步到后端和前端。
12. 后端部署 Render。
13. 前端部署 Vercel。
14. 用真实钱包做端到端领取验证。

## 20. 当前仓库已记录的验证状态

根据 `README.md` 当前记录：

- `contracts`: `forge test -vv` passes 7/7 airdrop tests.
- `backend`: `npm run build` passes TypeScript compilation.
- `frontend`: `npm run build` passes Vite production build.
- `backend API`: health、eligibility、sign endpoints 已用 test signer 跑通过。

如果你在新环境复现，请以你本机实际执行结果为准，并在部署前重新跑一遍第 16 节的验证清单。
