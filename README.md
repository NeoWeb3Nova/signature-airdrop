# Signature Airdrop

ECDSA signature-based airdrop demo for Base Sepolia.

Stack:
- Contracts: Foundry + Solidity + OpenZeppelin
- Backend: Nest.js + TypeScript + ethers v6
- Frontend: Vite + React + TypeScript + wagmi + RainbowKit

## Design

The airdrop contract supports multiple rounds. Each round has exactly one token type:

- `TokenType.ERC20`: user claims the signed ERC-20 amount.
- `TokenType.ERC721`: user claims one NFT; token IDs are assigned by the contract using an incrementing `nextTokenId`.

Each backend signature covers:

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

This prevents cross-user, cross-round, cross-contract, and cross-chain replay. The contract also tracks `claimed[round][tokenType][user]`.

## Contracts

Install Foundry dependencies after cloning because `contracts/lib/` is gitignored:

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
cp .env.example .env
# Edit .env with PRIVATE_KEY, SIGNER_ADDRESS, BASE_SEPOLIA_RPC_URL.

set -a
source .env
set +a

forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

Deploy and verify with Etherscan API V2:

```bash
cd contracts
set -a
source .env
set +a

forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  --verifier etherscan \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=84532" \
  --etherscan-api-key "$BASESCAN_API_KEY" \
  -vvvv
```

If deployment succeeded but verification failed, verify existing contracts manually:

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

After deployment, set these addresses:

- `backend/.env`: `AIRDROP_CONTRACT_ADDRESS=<deployed SignatureAirdrop>`
- `frontend/.env`: `VITE_AIRDROP_CONTRACT_ADDRESS=<deployed SignatureAirdrop>`
- Optionally update `backend/whitelist.json` token address fields for records/documentation.

## Backend

```bash
cd backend
cp .env.example .env
# Edit SIGNER_PRIVATE_KEY, AIRDROP_CONTRACT_ADDRESS, RPC_URL, etc.
npm install
npm run dev
```

API:

- `GET /api/health`
- `GET /api/eligibility?address=0x...&round=2`
- `POST /api/sign` with `{ "address": "0x...", "round": 2 }`

The whitelist currently contains 5 Anvil-style demo addresses for round 1 ERC-20 and round 2 ERC-721.

## Frontend

```bash
cd frontend
cp .env.example .env
# Edit VITE_AIRDROP_CONTRACT_ADDRESS and VITE_API_BASE_URL if needed.
npm install
npm run dev
```

Default local URLs:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000/api

## Vercel frontend deployment

This repository is a monorepo, and the Vite app lives in `frontend/`. The root
`vercel.json` configures the Vercel web service to use that subdirectory:

```bash
npm ci
npm run build
```

Vercel runs those commands with `frontend/` as the service root and publishes
`frontend/dist`. If the Vercel dashboard has an old manual Build Command such as
`vite build`, clear it so it does not bypass the repo config.

If Vite starts on another local port such as `5174`, the backend accepts that
local dev origin automatically. Add non-local browser origins to `CORS_ORIGIN`
as a comma-separated list.

## Verified locally

- `contracts`: `forge test -vv` passes 7/7 airdrop tests.
- `backend`: `npm run build` passes TypeScript compilation.
- `frontend`: `npm run build` passes Vite production build.
- `backend API`: health, eligibility, and sign endpoints were exercised with a test signer.
