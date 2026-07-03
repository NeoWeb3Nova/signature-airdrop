# Signature Airdrop Contracts

Foundry workspace for the Base Sepolia Signature Airdrop demo.

## Contracts

| File | Contract | Purpose |
| --- | --- | --- |
| `src/Airdrop.sol` | `SignatureAirdrop` | Main airdrop contract; verifies backend signatures and distributes ERC20/ERC721 rewards |
| `src/AirdropToken.sol` | `AirdropToken` | Demo ERC20 reward token |
| `src/AirdropNFT.sol` | `AirdropNFT` | Demo ERC721 reward NFT |
| `script/Deploy.s.sol` | `Deploy` | Deploys all contracts, funds ERC20 pool, transfers NFT ownership, configures two rounds |
| `test/Airdrop.t.sol` | `AirdropTest` | Foundry tests for success, replay protection, wrong signatures/nonces, pause, owner checks |

## Signature model

`SignatureAirdrop.claim()` verifies signatures over:

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

The digest is wrapped with `MessageHashUtils.toEthSignedMessageHash`, matching `ethers.Wallet.signMessage` in the backend.

Replay protection comes from:

- `recipient` binding.
- `round` binding.
- `address(this)` binding.
- `block.chainid` binding.
- Backend-provided `nonce`.
- On-chain `claimed[round][tokenType][user]` state.

## Install dependencies

`lib/` is ignored by Git, so install dependencies after cloning:

```bash
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
```

## Build and test

```bash
forge build
forge test -vv
```

Current verified result from the documentation sync:

```text
Ran 7 tests for test/Airdrop.t.sol:AirdropTest
7 passed; 0 failed; 0 skipped
```

## Environment

Copy the example file:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `BASE_SEPOLIA_RPC_URL` | Yes | Base Sepolia RPC endpoint |
| `PRIVATE_KEY` | Yes | Deployer key; pays gas and becomes owner |
| `SIGNER_ADDRESS` | Yes | Backend signer public address |
| `BASESCAN_API_KEY` | No | Etherscan API V2 key for verification |
| `VERIFIER_URL` | No | Base Sepolia Etherscan API V2 endpoint |

## Deploy to Base Sepolia

```bash
set -a
source .env
set +a

forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

The script executes:

1. Deploy `SignatureAirdrop(owner, signer)`.
2. Deploy `AirdropToken`.
3. Deploy `AirdropNFT`.
4. Mint `1_000_000 ether` of ERC20 rewards to the airdrop contract.
5. Transfer NFT ownership to the airdrop contract.
6. Configure Round 1 as ERC20 and Round 2 as ERC721.
7. Set `currentRound = 1`.

It prints:

```text
SIGNATURE_AIRDROP_ADDRESS=<airdrop>
AIRDROP_TOKEN_ADDRESS=<erc20>
AIRDROP_NFT_ADDRESS=<erc721>
```

## Deploy and verify

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

`foundry.toml` uses the Etherscan API V2 verifier URL for Base Sepolia. Avoid the deprecated BaseScan V1 endpoint.

## Post-deploy synchronization

After deployment, update:

- `backend/.env`: `AIRDROP_CONTRACT_ADDRESS=<SIGNATURE_AIRDROP_ADDRESS>`
- `frontend/.env.local`: `VITE_AIRDROP_CONTRACT_ADDRESS=<SIGNATURE_AIRDROP_ADDRESS>`
- Optionally `backend/whitelist.json` token fields for Round 1 and Round 2 documentation consistency.

Then verify the backend signer matches the contract:

```bash
cast call <SIGNATURE_AIRDROP_ADDRESS> "signer()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

## Common operations

```bash
# Query current round
cast call <SIGNATURE_AIRDROP_ADDRESS> "currentRound()(uint256)" --rpc-url "$BASE_SEPOLIA_RPC_URL"

# Query claimed state: round 1, token type 0 = ERC20
cast call <SIGNATURE_AIRDROP_ADDRESS> \
  "claimed(uint256,uint8,address)(bool)" \
  1 0 <USER_ADDRESS> \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"

# Pause claims
cast send <SIGNATURE_AIRDROP_ADDRESS> "pause()" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"

# Resume claims
cast send <SIGNATURE_AIRDROP_ADDRESS> "unpause()" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

## Notes

- `PRIVATE_KEY` controls owner-only functions; keep it separate from the backend signer in non-demo environments.
- `SIGNER_ADDRESS` must match the public address derived from backend `SIGNER_PRIVATE_KEY`.
- Round 1 uses token type `0` (`ERC20`); Round 2 uses token type `1` (`ERC721`).
- For ERC721 rewards, the contract mints sequential token IDs from the configured `nextTokenId`; the backend `amountOrTokenId` is still part of the signed payload and must be non-zero.
