# Signature Airdrop 项目开发与部署指南

> 中文主文档。英文镜像见 [`guild.en.md`](./guild.en.md)。前端在 `/#guide` 页面会根据语言切换渲染本文件或英文镜像。

## 1. 项目概览

Signature Airdrop 是一个部署在 Base Sepolia 测试网的 ECDSA 签名空投 Demo。当前仓库已经完成大面积改造，包含智能合约、Nest.js 后端签名服务、Vite React 领取前端、Demo 自助加入白名单能力，以及应用内中英文开发指南。

| 模块 | 路径 | 技术栈 | 作用 |
| --- | --- | --- | --- |
| 智能合约 | `contracts/` | Foundry、Solidity 0.8.24、OpenZeppelin | 配置空投轮次、校验签名、发放 ERC20 或 ERC721 奖励 |
| 后端 API | `backend/` | Nest.js 11、TypeScript、ethers v6 | 读取/持久化白名单、查询资格和已领取状态、生成 claim 签名 |
| 前端应用 | `frontend/` | Vite 7、React 19、wagmi 2、RainbowKit 2 | 钱包连接、轮次选择、自助加入白名单、请求签名并发起链上领取 |
| 部署配置 | `render.yaml`、`vercel.json` | Render、Vercel | 后端 Render Blueprint 与前端 monorepo Vercel 构建配置 |

核心流程：

1. 部署 `SignatureAirdrop`、Demo ERC20 token、Demo ERC721 NFT。
2. 部署脚本配置 Round 1 为 ERC20，Round 2 为 ERC721。
3. 后端读取 `backend/whitelist.json` 并规范化钱包地址。
4. 用户连接钱包后，前端调用 `/api/eligibility` 查询资格。
5. Demo 中不符合资格的用户可以通过前端按钮调用 `/api/whitelist/join` 自助加入白名单。
6. 符合资格的用户调用 `/api/sign` 获取签名，再向链上提交 `claim(round, amountOrTokenId, nonce, signature)`。
7. 合约恢复签名者地址，确认等于链上配置的 `signer`，随后记录 `claimed[round][tokenType][user]` 并发放奖励。

## 2. 代码结构

```text
signature-airdrop/
├── README.md
├── guild.md
├── guild.en.md
├── .env.example
├── render.yaml
├── vercel.json
├── contracts/
│   ├── foundry.toml
│   ├── .env.example
│   ├── src/Airdrop.sol
│   ├── src/AirdropToken.sol
│   ├── src/AirdropNFT.sol
│   ├── script/Deploy.s.sol
│   └── test/Airdrop.t.sol
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── whitelist.json
│   └── src/
│       ├── main.ts
│       ├── sign/
│       └── whitelist/
└── frontend/
    ├── package.json
    ├── .env.example
    ├── .env.local.example
    ├── src/App.tsx
    ├── src/components/ClaimPanel.tsx
    ├── src/components/DevelopmentGuide.tsx
    ├── src/config/Web3Provider.tsx
    ├── src/hooks/useAirdrop.ts
    └── src/i18n.tsx
```

## 3. 开发前准备

| 工具 | 用途 | 检查命令 |
| --- | --- | --- |
| Node.js 22 | 运行和构建后端/前端 | `node -v` |
| npm | 安装 JS/TS 依赖 | `npm -v` |
| Foundry | Solidity 编译、测试、部署 | `forge --version`、`cast --version` |
| Git | 版本管理 | `git --version` |
| Base Sepolia ETH | 支付部署和领取测试 gas | 钱包或区块浏览器查看 |
| Etherscan API V2 Key | 可选，用于合约验证 | https://etherscan.io/myapikey |
| WalletConnect Project ID | 生产环境 RainbowKit 钱包连接 | https://cloud.walletconnect.com/ |

如未安装 Foundry：

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge --version
```

## 4. 签名安全模型

后端签名和合约验签必须使用同一个消息哈希：

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

| 字段 | 作用 |
| --- | --- |
| `recipient` | 将签名绑定到单个钱包，防止 A 用户使用 B 用户签名 |
| `round` | 防止跨轮次重放 |
| `amountOrTokenId` | 绑定 ERC20 数量或 ERC721 领取载荷 |
| `nonce` | 提供每条白名单记录的唯一性 |
| `address(this)` | 防止跨合约重放 |
| `block.chainid` | 防止跨链重放 |

后端签名私钥只允许存在于服务端环境。绝不能通过前端 `VITE_` 环境变量暴露。

## 5. 环境变量

本地开发前复制示例文件：

```bash
cp contracts/.env.example contracts/.env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

### 5.1 合约环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `BASE_SEPOLIA_RPC_URL` | 是 | Base Sepolia RPC endpoint |
| `PRIVATE_KEY` | 是 | 部署者私钥，支付 gas，并成为合约 owner |
| `SIGNER_ADDRESS` | 是 | 后端签名私钥对应的钱包地址 |
| `BASESCAN_API_KEY` | 否 | Etherscan API V2 验证 key |
| `VERIFIER_URL` | 否 | `https://api.etherscan.io/v2/api?chainid=84532` |

### 5.2 后端环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `PORT` | 是 | 默认 `4000` |
| `CHAIN_ID` | 是 | Base Sepolia 是 `84532` |
| `RPC_URL` | 是 | 查询链上 `claimed` 状态使用的 RPC |
| `AIRDROP_CONTRACT_ADDRESS` | 是 | 已部署的 `SignatureAirdrop` 地址 |
| `SIGNER_PRIVATE_KEY` | 是 | 后端签名私钥，公钥地址必须等于合约 `signer()` |
| `WHITELIST_PATH` | 是 | 默认 `./whitelist.json`，相对 backend 工作目录 |
| `CORS_ORIGIN` | 是 | 额外允许的浏览器来源，多个用英文逗号分隔 |

`backend/src/main.ts` 会自动允许本地 `localhost` 和 `127.0.0.1` 任意端口，方便 Vite 在 5173、5174 等端口之间切换。

### 5.3 前端环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 是 | 后端 API base URL，例如 `http://localhost:4000/api` |
| `VITE_AIRDROP_CONTRACT_ADDRESS` | 是 | 已部署的空投合约地址 |
| `VITE_WALLETCONNECT_PROJECT_ID` | 建议 | WalletConnect/RainbowKit 项目 ID |

## 6. 智能合约开发流程

克隆后需要安装 Foundry 依赖，因为 `contracts/lib/` 被 git 忽略：

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

部署并验证：

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

部署脚本会执行：

1. 使用 owner 和 backend signer 部署 `SignatureAirdrop`。
2. 部署 Demo ERC20 `AirdropToken`。
3. 部署 Demo ERC721 `AirdropNFT`。
4. 给空投合约 mint `1_000_000 ether` 的 ERC20 奖励池。
5. 把 NFT owner 转给空投合约，让空投合约可以 mint NFT。
6. 配置 Round 1 ERC20 和 Round 2 ERC721。
7. 设置 `currentRound = 1`。

## 7. 后端开发流程

安装并本地运行：

```bash
cd backend
npm ci
npm run dev
```

默认 API base URL：

```text
http://localhost:4000/api
```

构建检查：

```bash
cd backend
npm run build
```

### 后端 API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/api/health` | 查看健康状态、签名者、chain ID、合约地址 |
| `GET` | `/api/eligibility?address=0x...&round=1` | 查询资格和已领取状态 |
| `POST` | `/api/sign` | 为符合资格且未领取的地址签名 |
| `GET` | `/api/whitelist` | 列出全部白名单，可选 `?round=1` |
| `GET` | `/api/whitelist/:address` | 查询某地址白名单记录，可选 `?round=1` |
| `POST` | `/api/whitelist` | 添加或更新白名单记录 |
| `POST` | `/api/whitelist/join` | Demo 自助加入白名单，前端按钮使用这个接口 |
| `DELETE` | `/api/whitelist` | 从某一轮移除地址 |

白名单格式：

```json
{
  "1": {
    "tokenType": "ERC20",
    "token": "0x...",
    "recipients": {
      "0xUser": "100000000000000000000"
    }
  },
  "2": {
    "tokenType": "ERC721",
    "token": "0x...",
    "recipients": {
      "0xUser": "1"
    }
  }
}
```

`WhitelistService` 会把更新持久化回 `backend/whitelist.json`。已有记录 nonce 来自 `round * 1_000_000 + index`；自助加入的新记录使用当前 round 的下一个可用 nonce。

## 8. 前端开发流程

安装并本地运行：

```bash
cd frontend
npm ci
npm run dev
```

默认 Vite 地址：

```text
http://localhost:5173
```

构建检查：

```bash
cd frontend
npm run build
```

页面路由：

| 路由 | 作用 |
| --- | --- |
| `/` 或 `/#claim` | 空投领取页面 |
| `/#guide` | 从 `guild.md` / `guild.en.md` 渲染的应用内开发指南 |

领取流程：

1. 通过 RainbowKit 连接钱包。
2. 选择 Round 1 ERC20 或 Round 2 ERC721。当前 hook 默认初始为 Round 2。
3. 调用 `${VITE_API_BASE_URL}/eligibility` 查询资格。
4. 如果不符合资格，点击 Demo 自助加入按钮调用 `/whitelist/join`，然后重新查询。
5. 如果符合资格且未领取，调用 `/sign` 请求签名。
6. 使用 wagmi 提交 `claim(round, amountOrTokenId, nonce, signature)`。
7. 等待交易回执，并在页面显示确认结果。

## 9. 本地端到端联调清单

1. 部署或选择一个真实 `SignatureAirdrop` 地址。
2. 在 `backend/.env` 配置 `AIRDROP_CONTRACT_ADDRESS`。
3. 在 `frontend/.env.local` 配置 `VITE_AIRDROP_CONTRACT_ADDRESS`。
4. 确认 `SIGNER_PRIVATE_KEY` 推导出的地址等于链上 `signer()`。
5. 启动后端：`cd backend && npm run dev`。
6. 检查 health：

```bash
curl http://localhost:4000/api/health
```

7. 查询资格：

```bash
curl "http://localhost:4000/api/eligibility?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266&round=1"
```

8. 请求签名：

```bash
curl -X POST http://localhost:4000/api/sign \
  -H "Content-Type: application/json" \
  -d '{"address":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","round":1}'
```

9. 启动前端并在浏览器里用 Base Sepolia 钱包完成一次领取。

## 10. Render 后端部署

`render.yaml` 当前定义：

| 配置项 | 当前值 |
| --- | --- |
| Service name | `signature-airdrop-backend` |
| Runtime | `node` |
| Root directory | `backend` |
| Region | `oregon` |
| Build command | `npm ci && npm run build` |
| Start command | `npm run start` |
| Health check | `/api/health` |
| Node version | `22` |
| Port | `4000` |
| Chain ID | `84532` |
| RPC URL | `https://sepolia.base.org` |
| Whitelist path | `./whitelist.json` |

以下变量需要在 Render 手动配置，因为它们是敏感或部署相关值：

```text
AIRDROP_CONTRACT_ADDRESS=0x...
SIGNER_PRIVATE_KEY=0x...
CORS_ORIGIN=https://your-vercel-domain.vercel.app,https://your-preview-domain.vercel.app
```

部署后检查：

```bash
curl https://<render-service-domain>/api/health
curl "https://<render-service-domain>/api/eligibility?address=<wallet>&round=1"
```

如果本机有 Render CLI，运维检查建议使用：

```bash
render services
render deploys list <service-id>
render logs <service-id>
```

## 11. Vercel 前端部署

仓库根目录 `vercel.json` 是前端 monorepo 部署的准确信息来源：

| Vercel 配置 | 当前值 |
| --- | --- |
| Framework | `vite` |
| Install command | `cd frontend && npm ci` |
| Build command | `cd frontend && npm run build` |
| Output directory | `frontend/dist` |
| SPA rewrite | `/(.*)` -> `/index.html` |

Vercel 环境变量：

```text
VITE_API_BASE_URL=https://<render-service-domain>/api
VITE_AIRDROP_CONTRACT_ADDRESS=0x...
VITE_WALLETCONNECT_PROJECT_ID=...
```

部署后打开 Vercel URL，连接钱包，查询资格，确认到 Render 的 CORS 请求成功。如果测试资金和白名单配置已准备好，再完成一次真实 Base Sepolia 领取。

## 12. 常用运维命令

查询 signer：

```bash
cast call <SIGNATURE_AIRDROP_ADDRESS> "signer()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

查询当前 round：

```bash
cast call <SIGNATURE_AIRDROP_ADDRESS> "currentRound()(uint256)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

查询已领取状态。Round 1 ERC20 的 token type 是 `0`，Round 2 ERC721 的 token type 是 `1`：

```bash
cast call <SIGNATURE_AIRDROP_ADDRESS> \
  "claimed(uint256,uint8,address)(bool)" \
  1 0 <USER_ADDRESS> \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

暂停和恢复：

```bash
cast send <SIGNATURE_AIRDROP_ADDRESS> "pause()" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"

cast send <SIGNATURE_AIRDROP_ADDRESS> "unpause()" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

更换 signer：

1. 生成或选择新的后端 signer 私钥。
2. 推导新地址：

```bash
cast wallet address --private-key "$NEW_SIGNER_PRIVATE_KEY"
```

3. 链上更新 signer：

```bash
cast send <SIGNATURE_AIRDROP_ADDRESS> \
  "setSigner(address)" \
  <NEW_SIGNER_ADDRESS> \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

4. 更新后端环境变量 `SIGNER_PRIVATE_KEY`。
5. 重启/重新部署后端并检查 `/api/health`。

## 13. 新增一轮空投

1. 链上调用 `configureRound(uint256,address,uint8,bool,uint256)` 配置新 round。
2. 在 `backend/whitelist.json` 增加对应 round。
3. 重启/重新部署后端，让白名单重新加载。
4. 在 `frontend/src/components/ClaimPanel.tsx` 增加 round 选项。
5. 在 `frontend/src/i18n.tsx` 增加中英文文案。
6. 重新构建并执行完整验证清单。

## 14. 常见问题排查

### 后端启动时报 `SIGNER_PRIVATE_KEY must be configured`

在 `backend/.env` 或 Render 中配置真实后端签名私钥。全 0 占位私钥会被代码主动拒绝。

### `/api/sign` 返回 `AIRDROP_CONTRACT_ADDRESS is not configured`

把已部署的 `SignatureAirdrop` 地址写入后端环境变量，并重启/重新部署。

### 前端提示合约地址未配置

配置 `VITE_AIRDROP_CONTRACT_ADDRESS`，然后重新构建/部署前端。

### 浏览器 CORS 报错

把当前 Vercel origin 追加到后端 `CORS_ORIGIN`。多个 origin 用英文逗号分隔。本地 localhost/127.0.0.1 已自动放行。

### 用户不符合资格

检查选择的 round、钱包地址、`backend/whitelist.json`，以及该地址是否已经领取。Demo 场景可以使用自助加入按钮，然后重新查询资格。

### 签名成功但 claim 失败

按顺序检查：前端/后端合约地址是否一致、后端 signer 是否等于链上 `signer()`、钱包是否在 Base Sepolia、round 是否 active、钱包是否已领取、ERC20 奖励池是否足够、NFT owner 是否已转给空投合约。

## 15. 安全注意事项

- 不要提交 `.env`、私钥、私有 RPC token。
- 非一次性 Demo 中，deployer/owner 和 backend signer 应使用不同账户。
- 后端 signer 不应持有生产合约 owner 权限。
- 发现 signer 泄漏或白名单污染时，应优先调用 `pause()` 暂停领取。
- 前端 `VITE_` 变量都是公开信息，只能放公开 URL 和合约地址。
- 改变白名单顺序会改变已有记录的确定性 nonce；正式活动中不要随意重排活跃名单。

## 16. 当前验证状态

本次文档同步已重新运行本地验证：

| 区域 | 命令 | 结果 |
| --- | --- | --- |
| 合约 | `cd contracts && forge test -vv` | 通过：7 个测试，0 失败 |
| 后端 | `cd backend && npm run build` | 通过 TypeScript 编译 |
| 前端 | `cd frontend && npm run build` | 通过 Vite 生产构建；Rollup 输出依赖注释和 chunk-size 警告 |

每次公开发版前，还应继续验证 Render health、Render logs/deploy 状态、Vercel 部署状态、浏览器 CORS，以及一次真实 Base Sepolia 钱包领取。
