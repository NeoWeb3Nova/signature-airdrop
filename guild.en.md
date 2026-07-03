# Signature Airdrop Development and Deployment Guide

> English mirror of [`guild.md`](./guild.md). The frontend renders this file on `/#guide` when the app language is English.

## 1. Project overview

Signature Airdrop is an ECDSA signature-gated airdrop demo on Base Sepolia. It now includes smart contracts, a Nest.js signing API, a Vite React claim UI, whitelist self-join for demos, and an in-app bilingual development guide.

| Module | Path | Stack | Responsibility |
| --- | --- | --- | --- |
| Smart contracts | `contracts/` | Foundry, Solidity 0.8.24, OpenZeppelin | Configure airdrop rounds, verify signatures, distribute ERC20 or ERC721 rewards |
| Backend API | `backend/` | Nest.js 11, TypeScript, ethers v6 | Load/persist whitelist, check eligibility and claimed state, generate claim signatures |
| Frontend app | `frontend/` | Vite 7, React 19, wagmi 2, RainbowKit 2 | Wallet connection, round selection, self-join whitelist, claim transaction |
| Deployment | `render.yaml`, `vercel.json` | Render, Vercel | Backend blueprint and frontend monorepo build config |

Core flow:

1. Deploy `SignatureAirdrop`, demo ERC20 token, and demo ERC721 NFT.
2. Configure Round 1 as ERC20 and Round 2 as ERC721.
3. Backend reads `backend/whitelist.json` and normalizes wallet addresses.
4. Frontend queries `/api/eligibility` after wallet connection.
5. Ineligible demo users can call `/api/whitelist/join` from the UI.
6. Eligible users call `/api/sign` and submit `claim(round, amountOrTokenId, nonce, signature)` on-chain.
7. Contract verifies the ECDSA signer and records `claimed[round][tokenType][user]`.

## 2. Repository structure

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

## 3. Prerequisites

| Tool | Purpose | Check command |
| --- | --- | --- |
| Node.js 22 | Backend and frontend runtime/builds | `node -v` |
| npm | Dependency installation | `npm -v` |
| Foundry | Solidity build/test/deploy | `forge --version`, `cast --version` |
| Git | Version control | `git --version` |
| Base Sepolia ETH | Deployment and claim gas | Wallet or block explorer |
| Etherscan API V2 key | Optional contract verification | https://etherscan.io/myapikey |
| WalletConnect Project ID | Production RainbowKit wallet connection | https://cloud.walletconnect.com/ |

Install Foundry if needed:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge --version
```

## 4. Signature security model

The backend and contract use the same hash:

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

| Field | Purpose |
| --- | --- |
| `recipient` | Binds the signature to one wallet |
| `round` | Prevents cross-round replay |
| `amountOrTokenId` | Binds the ERC20 amount or ERC721 claim payload |
| `nonce` | Provides per-entry uniqueness |
| `address(this)` | Prevents cross-contract replay |
| `block.chainid` | Prevents cross-chain replay |

The backend signer private key lives only in backend/server-side environments. It must never be exposed through frontend `VITE_` variables.

## 5. Environment variables

Copy examples before local development:

```bash
cp contracts/.env.example contracts/.env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

### 5.1 Contracts

| Variable | Required | Description |
| --- | --- | --- |
| `BASE_SEPOLIA_RPC_URL` | Yes | Base Sepolia RPC endpoint |
| `PRIVATE_KEY` | Yes | Deployer key; pays gas and becomes contract owner |
| `SIGNER_ADDRESS` | Yes | Public address derived from the backend signer key |
| `BASESCAN_API_KEY` | No | Etherscan API V2 key for verification |
| `VERIFIER_URL` | No | `https://api.etherscan.io/v2/api?chainid=84532` |

### 5.2 Backend

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | Default `4000` |
| `CHAIN_ID` | Yes | Base Sepolia is `84532` |
| `RPC_URL` | Yes | RPC used to read `claimed` state |
| `AIRDROP_CONTRACT_ADDRESS` | Yes | Deployed `SignatureAirdrop` address |
| `SIGNER_PRIVATE_KEY` | Yes | Backend signing key; public address must match contract `signer()` |
| `WHITELIST_PATH` | Yes | Default `./whitelist.json` from the backend working directory |
| `CORS_ORIGIN` | Yes | Extra allowed browser origins; comma-separated |

Local `localhost` and `127.0.0.1` origins on any port are accepted automatically by `backend/src/main.ts`.

### 5.3 Frontend

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | Backend API base URL, e.g. `http://localhost:4000/api` |
| `VITE_AIRDROP_CONTRACT_ADDRESS` | Yes | Deployed airdrop contract address |
| `VITE_WALLETCONNECT_PROJECT_ID` | Recommended | WalletConnect/RainbowKit project ID |

## 6. Smart contract workflow

Install dependencies after cloning because `contracts/lib/` is ignored:

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
```

Run tests:

```bash
cd contracts
forge test -vv
```

Deploy to Base Sepolia:

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

Deploy and verify:

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

The deployment script performs these steps:

1. Deploy `SignatureAirdrop` with owner and backend signer.
2. Deploy demo ERC20 `AirdropToken`.
3. Deploy demo ERC721 `AirdropNFT`.
4. Mint `1_000_000 ether` of ERC20 rewards to the airdrop contract.
5. Transfer NFT ownership to the airdrop contract so it can mint.
6. Configure Round 1 ERC20 and Round 2 ERC721.
7. Set `currentRound = 1`.

## 7. Backend workflow

Install and run locally:

```bash
cd backend
npm ci
npm run dev
```

Default API base URL:

```text
http://localhost:4000/api
```

Build check:

```bash
cd backend
npm run build
```

### Backend API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health, signer, chain ID, contract address |
| `GET` | `/api/eligibility?address=0x...&round=1` | Eligibility and claimed state |
| `POST` | `/api/sign` | Sign an eligible unclaimed claim |
| `GET` | `/api/whitelist` | List all entries; optional `?round=1` |
| `GET` | `/api/whitelist/:address` | List entries for one address; optional `?round=1` |
| `POST` | `/api/whitelist` | Add/update a whitelist entry |
| `POST` | `/api/whitelist/join` | Demo self-join endpoint used by the frontend |
| `DELETE` | `/api/whitelist` | Remove an address from a round |

Whitelist shape:

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

`WhitelistService` persists updates back to `backend/whitelist.json`. Existing entries get deterministic nonces from `round * 1_000_000 + index`; newly joined entries use the next available nonce for that round.

## 8. Frontend workflow

Install and run locally:

```bash
cd frontend
npm ci
npm run dev
```

Default Vite URL:

```text
http://localhost:5173
```

Build check:

```bash
cd frontend
npm run build
```

Routes:

| Route | Purpose |
| --- | --- |
| `/` or `/#claim` | Claim panel |
| `/#guide` | In-app guide rendered from `guild.md` / `guild.en.md` |

Claim flow:

1. Connect wallet with RainbowKit.
2. Select Round 1 ERC20 or Round 2 ERC721. The hook currently initializes to Round 2.
3. Query eligibility from `${VITE_API_BASE_URL}/eligibility`.
4. If not eligible, use the demo self-join button to call `/whitelist/join`, then re-query.
5. If eligible and unclaimed, request a signature from `/sign`.
6. Submit `claim(round, amountOrTokenId, nonce, signature)` with wagmi.
7. Wait for the transaction receipt and display confirmation.

## 9. Local end-to-end checklist

1. Deploy or choose a real `SignatureAirdrop` address.
2. Set `AIRDROP_CONTRACT_ADDRESS` in `backend/.env`.
3. Set `VITE_AIRDROP_CONTRACT_ADDRESS` in `frontend/.env.local`.
4. Confirm `SIGNER_PRIVATE_KEY` derives to the on-chain `signer()` address.
5. Start backend: `cd backend && npm run dev`.
6. Check health:

```bash
curl http://localhost:4000/api/health
```

7. Query eligibility:

```bash
curl "http://localhost:4000/api/eligibility?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266&round=1"
```

8. Request a signature:

```bash
curl -X POST http://localhost:4000/api/sign \
  -H "Content-Type: application/json" \
  -d '{"address":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","round":1}'
```

9. Start frontend and execute a browser claim on Base Sepolia.

## 10. Render backend deployment

`render.yaml` defines:

| Setting | Value |
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

Set these in Render manually because they are secrets or deployment-specific:

```text
AIRDROP_CONTRACT_ADDRESS=0x...
SIGNER_PRIVATE_KEY=0x...
CORS_ORIGIN=https://your-vercel-domain.vercel.app,https://your-preview-domain.vercel.app
```

Post-deployment checks:

```bash
curl https://<render-service-domain>/api/health
curl "https://<render-service-domain>/api/eligibility?address=<wallet>&round=1"
```

Use Render CLI for operational checks when available:

```bash
render services
render deploys list <service-id>
render logs <service-id>
```

## 11. Vercel frontend deployment

The repository root `vercel.json` is the source of truth:

| Vercel setting | Value |
| --- | --- |
| Framework | `vite` |
| Install command | `cd frontend && npm ci` |
| Build command | `cd frontend && npm run build` |
| Output directory | `frontend/dist` |
| SPA rewrite | `/(.*)` -> `/index.html` |

Set Vercel env variables:

```text
VITE_API_BASE_URL=https://<render-service-domain>/api
VITE_AIRDROP_CONTRACT_ADDRESS=0x...
VITE_WALLETCONNECT_PROJECT_ID=...
```

After deploy, open the Vercel URL, connect wallet, query eligibility, verify CORS to Render, and run one real claim on Base Sepolia if test funds are available.

## 12. Operations

Query signer:

```bash
cast call <SIGNATURE_AIRDROP_ADDRESS> "signer()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Query current round:

```bash
cast call <SIGNATURE_AIRDROP_ADDRESS> "currentRound()(uint256)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Query claimed state. Round 1 ERC20 uses token type `0`; Round 2 ERC721 uses token type `1`:

```bash
cast call <SIGNATURE_AIRDROP_ADDRESS> \
  "claimed(uint256,uint8,address)(bool)" \
  1 0 <USER_ADDRESS> \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Pause and resume:

```bash
cast send <SIGNATURE_AIRDROP_ADDRESS> "pause()" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"

cast send <SIGNATURE_AIRDROP_ADDRESS> "unpause()" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Rotate signer:

1. Generate or choose a new backend signer key.
2. Derive the new public address:

```bash
cast wallet address --private-key "$NEW_SIGNER_PRIVATE_KEY"
```

3. Update the contract signer:

```bash
cast send <SIGNATURE_AIRDROP_ADDRESS> \
  "setSigner(address)" \
  <NEW_SIGNER_ADDRESS> \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

4. Update `SIGNER_PRIVATE_KEY` in the backend environment.
5. Restart/redeploy backend and check `/api/health`.

## 13. Add a new round

1. Configure the new round on-chain with `configureRound(uint256,address,uint8,bool,uint256)`.
2. Add a matching round in `backend/whitelist.json`.
3. Restart/redeploy backend so the whitelist reloads.
4. Add the round option in `frontend/src/components/ClaimPanel.tsx`.
5. Add i18n labels in `frontend/src/i18n.tsx`.
6. Rebuild and run the full verification checklist.

## 14. Troubleshooting

### Backend fails with `SIGNER_PRIVATE_KEY must be configured`

Set a real backend signer private key in `backend/.env` or Render. The placeholder zero key is intentionally rejected.

### `/api/sign` returns `AIRDROP_CONTRACT_ADDRESS is not configured`

Set the deployed `SignatureAirdrop` address in the backend environment and restart/redeploy.

### Frontend says the contract address is missing

Set `VITE_AIRDROP_CONTRACT_ADDRESS` and rebuild/redeploy the frontend.

### Browser CORS error

Append the current Vercel origin to backend `CORS_ORIGIN`. Multiple origins are comma-separated. Localhost and 127.0.0.1 are already accepted for development.

### User is not eligible

Check the selected round, wallet address, `backend/whitelist.json`, and whether the address already claimed. For demos, the user can use the self-join button and then re-query eligibility.

### Signature succeeds but claim fails

Check, in order: frontend/backend contract address match, signer address equals contract `signer()`, wallet is on Base Sepolia, round is active, wallet has not claimed, ERC20 balance is sufficient, and NFT ownership was transferred to the airdrop contract.

## 15. Security notes

- Never commit `.env` files, private keys, or private RPC tokens.
- Keep deployer/owner and backend signer as separate accounts outside throwaway demos.
- Backend signer should not hold owner privileges in production.
- Use `pause()` immediately if signer leakage or whitelist corruption is suspected.
- Frontend `VITE_` variables are public; only put public addresses and URLs there.
- Changing whitelist order changes deterministic nonces for existing entries; avoid reshuffling active campaign data.

## 16. Verification status

Fresh verification from the documentation sync:

| Area | Command | Result |
| --- | --- | --- |
| Contracts | `cd contracts && forge test -vv` | Passed: 7 tests, 0 failed |
| Backend | `cd backend && npm run build` | Passed TypeScript compilation |
| Frontend | `cd frontend && npm run build` | Passed Vite production build; Rollup emitted dependency annotation/chunk-size warnings |

Before every public release, also verify deployed Render health, Render logs/deploy state, Vercel deployment status, browser CORS, and one real wallet claim on Base Sepolia.
