# Signature Airdrop Development and Deployment Guide

> This is the English mirror of `guild.md`. It documents the real repository structure, configuration files, scripts, deployment flow, and verification steps for reproducing the Signature Airdrop project from development to production.

## 1. Project overview

Signature Airdrop is an ECDSA signature-gated airdrop demo deployed on Base Sepolia. It contains three layers:

| Module | Path | Stack | Responsibility |
| --- | --- | --- | --- |
| Smart contracts | `contracts/` | Foundry, Solidity 0.8.24, OpenZeppelin | Manage airdrop rounds, verify backend signatures, distribute ERC20 or ERC721 rewards |
| Backend service | `backend/` | Nest.js, TypeScript, ethers v6 | Read the whitelist, check eligibility, generate claim signatures |
| Frontend app | `frontend/` | Vite, React 19, TypeScript, wagmi, RainbowKit | Connect wallets, query eligibility, request signatures, submit on-chain claims |

Core flow:

1. The contract owner deploys `SignatureAirdrop`, a test ERC20 token, and a test ERC721 token.
2. The deployment script configures two rounds:
   - Round 1: ERC20 reward.
   - Round 2: ERC721 reward.
3. The backend reads `backend/whitelist.json` and checks whether an address is eligible for a round.
4. The frontend calls `/api/eligibility` after the user connects a wallet.
5. The frontend calls `/api/sign` before claiming.
6. The frontend sends `round`, `amountOrTokenId`, `nonce`, and `signature` to the contract `claim()` function.
7. The contract recovers the signer, confirms it matches the configured backend signer, then transfers ERC20 or mints ERC721.

## 2. Repository structure

```text
signature-airdrop/
├── README.md
├── guild.md
├── guild.en.md
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
        │   ├── ClaimPanel.tsx
        │   └── DevelopmentGuide.tsx
        ├── config/
        │   └── Web3Provider.tsx
        ├── hooks/
        │   └── useAirdrop.ts
        └── abi/
            └── airdrop.ts
```

## 3. Prerequisites

### 3.1 Required tools

| Tool | Purpose | Check command |
| --- | --- | --- |
| Node.js 22 | Run the Nest.js backend and Vite frontend | `node -v` |
| npm | Install JavaScript and TypeScript dependencies | `npm -v` |
| Foundry | Compile, test, and deploy Solidity contracts | `forge --version`, `cast --version` |
| Git | Version control | `git --version` |
| Base Sepolia ETH | Pay deployment and claim gas | Check wallet or block explorer balance |
| Etherscan API V2 key | Optional contract verification | https://etherscan.io/myapikey |
| WalletConnect Project ID | Optional RainbowKit wallet connection | https://cloud.walletconnect.com/ |

### 3.2 Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge --version
```

### 3.3 Clone and enter the repository

```bash
git clone <your-repo-url> signature-airdrop
cd signature-airdrop
```

## 4. Step 1: Understand the signature security model

The backend and contract must sign and verify the same message. The current message hash is:

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
| `recipient` | Binds the signature to the claimant address |
| `round` | Prevents cross-round signature reuse |
| `amountOrTokenId` | ERC20 amount or ERC721 reward identifier/placeholder |
| `nonce` | Adds per-entry uniqueness |
| `address(this)` | Prevents cross-contract replay |
| `block.chainid` | Prevents cross-chain replay |

The signer key lives in the backend environment. Never expose `SIGNER_PRIVATE_KEY` to the frontend or commit it to Git.

## 5. Step 2: Develop and test the smart contracts

### 5.1 Install contract dependencies

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts
forge build
```

### 5.2 Contract responsibilities

| File | Responsibility |
| --- | --- |
| `src/Airdrop.sol` | Main airdrop contract, round management, signature verification, claim state |
| `src/AirdropToken.sol` | Test ERC20 reward token |
| `src/AirdropNFT.sol` | Test ERC721 reward NFT |
| `script/Deploy.s.sol` | Deploy and configure contracts |
| `test/Airdrop.t.sol` | Foundry tests for claim and failure paths |

### 5.3 Main contract interfaces

Typical interfaces to inspect before integration:

```solidity
function claim(uint256 round, uint256 amountOrTokenId, uint256 nonce, bytes calldata signature) external;
function hasClaimed(uint256 round, address user) external view returns (bool);
function setSigner(address signer) external;
function setRound(uint256 round, RoundConfig calldata config) external;
function pause() external;
function unpause() external;
```

### 5.4 Run local contract tests

```bash
cd contracts
forge test -vvv
```

## 6. Step 3: Prepare environment variables

### 6.1 Contract environment variables

Create `contracts/.env` from `contracts/.env.example` and configure:

```bash
PRIVATE_KEY=<deployer-private-key>
RPC_URL=<base-sepolia-rpc-url>
ETHERSCAN_API_KEY=<etherscan-api-key>
SIGNER_ADDRESS=<backend-signer-address>
```

### 6.2 Backend environment variables

Create `backend/.env` from `backend/.env.example` and configure:

```bash
PORT=3001
CHAIN_ID=84532
RPC_URL=<base-sepolia-rpc-url>
AIRDROP_CONTRACT_ADDRESS=<deployed-airdrop-contract>
SIGNER_PRIVATE_KEY=<backend-signer-private-key>
CORS_ORIGIN=http://localhost:5173,https://frontend-coral-eta-75.vercel.app
```

### 6.3 Frontend environment variables

Create `frontend/.env.local` from `frontend/.env.local.example` and configure:

```bash
VITE_CHAIN_ID=84532
VITE_AIRDROP_CONTRACT_ADDRESS=<deployed-airdrop-contract>
VITE_API_BASE_URL=http://localhost:3001
VITE_WALLETCONNECT_PROJECT_ID=<walletconnect-project-id>
```

## 7. Step 4: Deploy contracts to Base Sepolia

### 7.1 Load contract env

```bash
cd contracts
source .env
```

### 7.2 Deploy without verification

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$RPC_URL" \
  --broadcast
```

### 7.3 Deploy and verify

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY"
```

### 7.4 Manual verification after deployment

If deployment succeeds but verification fails, verify each contract manually with `forge verify-contract` and the correct constructor arguments.

## 8. Step 5: Sync deployed addresses

### 8.1 Update the backend

Set `AIRDROP_CONTRACT_ADDRESS` in `backend/.env` and in the Render service environment.

### 8.2 Update the frontend

Set `VITE_AIRDROP_CONTRACT_ADDRESS` in `frontend/.env.local` and in the Vercel project environment.

### 8.3 Optional: update whitelist token fields

If `backend/whitelist.json` stores reward token addresses or token identifiers, keep them in sync with deployed contract addresses.

## 9. Step 6: Develop and run the backend

### 9.1 Install dependencies

```bash
cd backend
npm install
```

### 9.2 Whitelist format

`backend/whitelist.json` stores per-round entries. Each entry should include the user address, reward data, nonce, and claim metadata required by the signer service.

### 9.3 Start the dev server

```bash
npm run start:dev
```

### 9.4 Backend API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Health check |
| `GET /api/eligibility?address=<addr>&round=<round>` | Check whether an address is eligible |
| `POST /api/sign` | Return a signature for an eligible claim |

### 9.5 Backend build check

```bash
npm run build
```

## 10. Step 7: Develop and run the frontend

### 10.1 Install dependencies

```bash
cd frontend
npm install
```

### 10.2 Start the dev server

```bash
npm run dev
```

### 10.3 Frontend flow

1. Open the Vite app.
2. Connect a wallet on Base Sepolia.
3. Select an airdrop round.
4. Query eligibility.
5. Request a backend signature.
6. Submit the `claim()` transaction.
7. Confirm the transaction and status in the UI.

The app also includes a developer guide page at `/#guide` and a claim page at `/#claim`.

### 10.4 Frontend build check

```bash
npm run build
```

## 11. Step 8: Local end-to-end integration

### 11.1 Confirm contracts are deployed

Use BaseScan or `cast` to confirm the deployed addresses and signer configuration.

### 11.2 Start the backend

```bash
cd backend
npm run start:dev
```

### 11.3 Check health

```bash
curl http://localhost:3001/api/health
```

### 11.4 Query eligibility

```bash
curl "http://localhost:3001/api/eligibility?address=<wallet>&round=1"
```

### 11.5 Request a signature

```bash
curl -X POST http://localhost:3001/api/sign \
  -H 'content-type: application/json' \
  -d '{"address":"<wallet>","round":1}'
```

### 11.6 Start the frontend and claim

```bash
cd frontend
npm run dev
```

Open the app, connect the same wallet, query eligibility, and claim.

## 12. Step 9: Deploy backend to Render

### 12.1 Render Blueprint deployment

This repository includes `render.yaml`. Connect the GitHub repository to Render and create the service from the blueprint.

### 12.2 Render environment variables

Verify the Render environment includes the production values for:

```bash
CHAIN_ID
RPC_URL
AIRDROP_CONTRACT_ADDRESS
SIGNER_PRIVATE_KEY
CORS_ORIGIN
```

### 12.3 Post-deployment checks

```bash
curl https://<render-service-url>/api/health
curl "https://<render-service-url>/api/eligibility?address=<wallet>&round=1"
```

## 13. Step 10: Deploy frontend to Vercel

### 13.1 Vercel project settings

Set the frontend root directory to `frontend/` and use the default Vite build command:

```bash
npm run build
```

### 13.2 Vercel environment variables

Configure:

```bash
VITE_CHAIN_ID=84532
VITE_AIRDROP_CONTRACT_ADDRESS=<deployed-airdrop-contract>
VITE_API_BASE_URL=<render-backend-url>
VITE_WALLETCONNECT_PROJECT_ID=<walletconnect-project-id>
```

### 13.3 Frontend deployment checks

Open the Vercel URL, connect a wallet, query eligibility, and verify that CORS requests to the backend succeed.

## 14. Step 11: Common operations

### 14.1 Query signer

```bash
cast call <airdrop-contract> "signer()(address)" --rpc-url "$RPC_URL"
```

### 14.2 Query current round configuration

Use the public getter exposed by the contract for the relevant round.

### 14.3 Query whether a user has claimed

```bash
cast call <airdrop-contract> "hasClaimed(uint256,address)(bool)" 1 <wallet> --rpc-url "$RPC_URL"
```

### 14.4 Pause claims

```bash
cast send <airdrop-contract> "pause()" --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL"
```

### 14.5 Resume claims

```bash
cast send <airdrop-contract> "unpause()" --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL"
```

### 14.6 Rotate backend signer

1. Generate or choose the new backend signer wallet.
2. Update `SIGNER_PRIVATE_KEY` in the backend deployment environment.
3. Call `setSigner(newSigner)` on the airdrop contract.
4. Restart/redeploy the backend.
5. Verify `/api/sign` returns signatures recoverable to the new signer.

## 15. Step 12: Add a new airdrop round

### 15.1 Configure the round on-chain

Call the owner-only round configuration function with the new reward type, token address, and round parameters.

### 15.2 Update backend whitelist

Add the new round entries in `backend/whitelist.json` with correct addresses, reward data, and nonces.

### 15.3 Update frontend round selector

Add the new round option in `frontend/src/components/ClaimPanel.tsx` and verify the UI queries the correct round.

## 16. Step 13: Verification checklist

Before calling the project ready, verify:

- `forge test` passes.
- Backend `npm run build` passes.
- Frontend `npm run build` passes.
- `/api/health` returns healthy.
- `/api/eligibility` returns expected whitelist state.
- `/api/sign` returns a signature for eligible addresses only.
- Frontend claim flow works on Base Sepolia.
- The GitHub About link points to the Vercel deployment.
- Render CORS allows the Vercel frontend URL.

## 17. Troubleshooting

### 17.1 Backend reports `SIGNER_PRIVATE_KEY must be configured`

Set `SIGNER_PRIVATE_KEY` in `backend/.env` locally or in the Render service environment. Never expose it in frontend variables.

### 17.2 `/api/sign` returns `AIRDROP_CONTRACT_ADDRESS is not configured`

Set `AIRDROP_CONTRACT_ADDRESS` to the deployed airdrop contract and restart the backend.

### 17.3 Frontend reports missing contract address

Set `VITE_AIRDROP_CONTRACT_ADDRESS` in `frontend/.env.local` or Vercel environment variables, then rebuild.

### 17.4 Browser CORS error

Add the frontend origin to backend `CORS_ORIGIN`. Include both local and deployed frontend URLs when needed.

### 17.5 User is not eligible

Check `backend/whitelist.json`, address casing/normalization, selected round, and whether the user already claimed.

### 17.6 Signature succeeds but claim fails

Check chain ID, contract address, round, nonce, reward amount/token ID, signer address, and whether the wallet is connected to Base Sepolia.

### 17.7 Contract verification fails

Verify the compiler version, constructor arguments, optimizer settings, and selected chain in the verification command.

## 18. Security notes

- Never commit private keys or `.env` files.
- Keep signer rotation documented and tested.
- Bind signatures to recipient, round, contract address, and chain ID.
- Use `nonce` and `hasClaimed` to prevent replay.
- Keep CORS as narrow as possible for production.
- Use testnet keys and test assets for demos.

## 19. Recommended development order

1. Compile and test contracts locally.
2. Deploy contracts to Base Sepolia.
3. Sync deployed addresses into backend and frontend env files.
4. Run backend locally and verify API endpoints.
5. Run frontend locally and execute an end-to-end claim.
6. Deploy backend to Render.
7. Deploy frontend to Vercel.
8. Update GitHub About with the Vercel URL.
9. Re-run the public deployment verification checklist.

## 20. Current repository verification status

The repository currently tracks:

- A Render backend deployment blueprint in `render.yaml`.
- Vercel frontend project metadata under `frontend/.vercel/` locally, ignored from Git.
- A deployed frontend URL: `https://frontend-coral-eta-75.vercel.app`.
- GitHub repository metadata pointing to the Vercel frontend URL.
- A frontend developer guide page at `/#guide` that supports Chinese and English through the app language toggle.
