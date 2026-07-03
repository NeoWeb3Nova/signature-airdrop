<div align="center">

# Signature Drop

**Base Sepolia ECDSA 签名空投 Demo**

<p>
  <a href="./README.md"><img alt="Language: English" src="https://img.shields.io/badge/English-switch-f8fafc?style=for-the-badge&labelColor=111827"></a>
  <a href="./README.zh.md"><img alt="语言：中文" src="https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E5%BD%93%E5%89%8D-111827?style=for-the-badge&labelColor=2563eb"></a>
</p>

<p>
  <a href="#项目概览"><img alt="项目概览" src="https://img.shields.io/badge/%E9%A1%B9%E7%9B%AE%E6%A6%82%E8%A7%88-111827?style=flat-square"></a>
  <a href="#快速开始"><img alt="快速开始" src="https://img.shields.io/badge/%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B-2563eb?style=flat-square"></a>
  <a href="#部署"><img alt="部署" src="https://img.shields.io/badge/%E9%83%A8%E7%BD%B2-7c3aed?style=flat-square"></a>
  <a href="./guild.md"><img alt="开发指南" src="https://img.shields.io/badge/%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97-0f172a?style=flat-square"></a>
  <a href="./contracts/README.md"><img alt="合约文档" src="https://img.shields.io/badge/%E5%90%88%E7%BA%A6%E6%96%87%E6%A1%A3-059669?style=flat-square"></a>
</p>

<p>
  <img alt="Solidity 0.8.24" src="https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity&style=flat-square">
  <img alt="Foundry" src="https://img.shields.io/badge/Foundry-Contracts-f97316?style=flat-square">
  <img alt="Nest.js 11" src="https://img.shields.io/badge/Nest.js-11-e0234e?logo=nestjs&logoColor=white&style=flat-square">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=111827&style=flat-square">
  <img alt="Vite 7" src="https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white&style=flat-square">
  <img alt="Base Sepolia" src="https://img.shields.io/badge/Base_Sepolia-84532-0052ff?style=flat-square">
</p>

</div>

---

<p align="center">
  <img src="./docs/assets/signature-drop-ui.png" alt="Signature Drop 领取页面截图" width="860">
</p>

## 项目概览

Signature Drop 是一个完整的 Web3 签名空投 Demo。用户只有在后端 signer 为其白名单资格生成授权签名后，才能在 Base Sepolia 上领取 ERC20 或 ERC721 奖励。当前仓库包含 Foundry 合约、Nest.js 签名 API、React 领取前端、Render 后端部署配置、Vercel 前端部署配置，以及应用内中英文开发指南。

| 模块 | 路径 | 技术栈 | 作用 |
| --- | --- | --- | --- |
| 智能合约 | `contracts/` | Foundry、Solidity 0.8.24、OpenZeppelin | 部署 `SignatureAirdrop`、Demo ERC20、Demo ERC721；配置轮次；校验领取签名 |
| 后端 API | `backend/` | Nest.js 11、TypeScript、ethers v6 | 读取/持久化白名单、查询资格和已领取状态、为符合资格的用户签名 |
| 前端应用 | `frontend/` | Vite 7、React 19、wagmi 2、RainbowKit 2 | 钱包连接、轮次选择、自助加入白名单、请求签名并发起链上领取 |
| 部署配置 | 根目录配置 | Render + Vercel | 后端 Render Blueprint 与前端 Vercel monorepo 部署配置 |

## 应用路由

Vite 前端是单页应用，使用 hash 路由：

- `/#claim` 或 `/` — 空投领取页面。
- `/#guide` — 从 `guild.md` 和 `guild.en.md` 渲染的中英文开发/部署指南。

应用内语言切换会把选择持久化到 `localStorage`，并在中英文指南之间切换。

## 签名安全模型

后端签名的 payload 与合约验签的 payload 完全一致：

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

每个授权签名绑定以下信息：

| 字段 | 防重放作用 |
| --- | --- |
| `recipient` | 防止一个钱包使用另一个钱包的签名 |
| `round` | 防止跨轮次复用 |
| `amountOrTokenId` | 绑定 ERC20 数量或 ERC721 领取载荷 |
| `nonce` | 白名单服务生成的每条记录唯一值 |
| `address(this)` | 防止跨合约重放 |
| `block.chainid` | 防止跨链重放 |

链上通过 `claimed[round][tokenType][user]` 记录领取状态，因此同一用户在同一 round/token type 下最多只能领取一次。

## 仓库结构

```text
signature-airdrop/
├── README.md
├── README.zh.md              # GitHub 中文 README
├── guild.md                  # 中文开发/部署指南
├── guild.en.md               # 英文指南，应用内英文 guide 使用
├── render.yaml               # Render 后端 Blueprint
├── vercel.json               # Vercel monorepo 前端配置
├── docs/assets/
│   └── signature-drop-ui.png
├── contracts/
│   ├── foundry.toml
│   ├── src/Airdrop.sol
│   ├── src/AirdropToken.sol
│   ├── src/AirdropNFT.sol
│   ├── script/Deploy.s.sol
│   └── test/Airdrop.t.sol
├── backend/
│   ├── src/main.ts
│   ├── src/sign/
│   ├── src/whitelist/
│   └── whitelist.json
└── frontend/
    ├── src/App.tsx
    ├── src/components/ClaimPanel.tsx
    ├── src/components/DevelopmentGuide.tsx
    ├── src/config/Web3Provider.tsx
    └── src/hooks/useAirdrop.ts
```

## 快速开始

### 前置条件

- Node.js 22 和 npm。
- Foundry (`forge`, `cast`)。
- Base Sepolia ETH，用于部署和领取测试 gas。
- 如果需要合约验证，需要 Etherscan API V2 key。
- 生产环境 RainbowKit 钱包连接建议配置 WalletConnect Project ID。

### 环境变量

复制示例文件，并且不要把真实值提交到 Git：

```bash
cp contracts/.env.example contracts/.env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

| 文件 | 关键变量 |
| --- | --- |
| `contracts/.env` | `BASE_SEPOLIA_RPC_URL`, `PRIVATE_KEY`, `SIGNER_ADDRESS`, `BASESCAN_API_KEY` |
| `backend/.env` | `PORT`, `CHAIN_ID`, `RPC_URL`, `AIRDROP_CONTRACT_ADDRESS`, `SIGNER_PRIVATE_KEY`, `WHITELIST_PATH`, `CORS_ORIGIN` |
| `frontend/.env.local` | `VITE_API_BASE_URL`, `VITE_AIRDROP_CONTRACT_ADDRESS`, `VITE_WALLETCONNECT_PROJECT_ID` |

不要把 `PRIVATE_KEY` 或 `SIGNER_PRIVATE_KEY` 放入前端环境变量。

## 合约

克隆后需要安装 Foundry 依赖，因为 `contracts/lib/` 被 Git 忽略：

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
```

运行测试：

```bash
cd contracts
forge test -vv
```

部署到 Base Sepolia：

```bash
cd contracts
set -a
source .env
set +a

forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

通过 Etherscan API V2 部署并验证：

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

部署脚本会打印：

```text
SIGNATURE_AIRDROP_ADDRESS=<deployed SignatureAirdrop>
AIRDROP_TOKEN_ADDRESS=<deployed ERC20 token>
AIRDROP_NFT_ADDRESS=<deployed ERC721 token>
```

至少需要把 `SIGNATURE_AIRDROP_ADDRESS` 同步到：

- `backend/.env`: `AIRDROP_CONTRACT_ADDRESS=<SIGNATURE_AIRDROP_ADDRESS>`
- `frontend/.env.local`: `VITE_AIRDROP_CONTRACT_ADDRESS=<SIGNATURE_AIRDROP_ADDRESS>`

## 后端

```bash
cd backend
npm ci
npm run dev
```

默认本地 API base URL：`http://localhost:4000/api`。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康状态、signer 地址、chain ID、空投合约地址 |
| `GET` | `/api/eligibility?address=0x...&round=1` | 查询某个钱包/轮次的资格和已领取状态 |
| `POST` | `/api/sign` | 为符合资格且未领取的地址返回 claim 签名 |
| `GET` | `/api/whitelist` | 列出白名单记录，可选 `?round=1` |
| `GET` | `/api/whitelist/:address` | 查询某个地址的记录，可选 `?round=1` |
| `POST` | `/api/whitelist` | Demo/admin 添加或更新地址 |
| `POST` | `/api/whitelist/join` | 前端 Demo 自助加入白名单接口 |
| `DELETE` | `/api/whitelist` | 从某个轮次移除地址 |

白名单持久化在 `backend/whitelist.json`。当前数据包含六个 Demo 地址，覆盖 Round 1 ERC20 与 Round 2 ERC721。

## 前端

```bash
cd frontend
npm ci
npm run dev
```

默认本地前端地址：`http://localhost:5173`。

领取 UI 默认从 Round 2 开始，支持 Round 1 ERC20 和 Round 2 ERC721。当连接钱包不符合资格时，页面会显示自助加入白名单按钮。

## 部署

### Render 后端

`render.yaml` 定义了 Node web service：

| 配置 | 值 |
| --- | --- |
| Service | `signature-airdrop-backend` |
| Root directory | `backend` |
| Region | `oregon` |
| Build command | `npm ci && npm run build` |
| Start command | `npm run start` |
| Health check | `/api/health` |
| Node version | `22` |

以下敏感变量需要在 Render 手动配置，因为它们标记为 `sync: false`：

- `AIRDROP_CONTRACT_ADDRESS`
- `SIGNER_PRIVATE_KEY`

`CORS_ORIGIN` 必须包含允许访问 API 的 Vercel 生产/预览域名。

### Vercel 前端

根目录 `vercel.json` 是 monorepo 前端部署的准确信息来源：

```json
{
  "framework": "vite",
  "installCommand": "cd frontend && npm ci",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist"
}
```

配置 Vercel 环境变量：

```text
VITE_API_BASE_URL=https://<render-service-domain>/api
VITE_AIRDROP_CONTRACT_ADDRESS=<SIGNATURE_AIRDROP_ADDRESS>
VITE_WALLETCONNECT_PROJECT_ID=<walletconnect-project-id>
```

## 验证状态

本次文档同步中的本地验证结果：

| 区域 | 命令 | 结果 |
| --- | --- | --- |
| 合约 | `cd contracts && forge test -vv` | 通过：7 tests, 0 failed |
| 后端 | `cd backend && npm run build` | 通过 TypeScript 编译 |
| 前端 | `cd frontend && npm run build` | 通过 Vite 生产构建；Rollup 输出第三方依赖注释/chunk-size 警告 |

## 更多文档

- English README: [`README.md`](./README.md)
- 中文开发指南: [`guild.md`](./guild.md)
- English guide: [`guild.en.md`](./guild.en.md)
- 合约文档: [`contracts/README.md`](./contracts/README.md)
