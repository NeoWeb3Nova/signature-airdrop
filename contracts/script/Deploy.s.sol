// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --verify --etherscan-api-key "$BASESCAN_API_KEY" --broadcast -vvvv

import {Script, console2} from "forge-std/Script.sol";
import {SignatureAirdrop} from "../src/Airdrop.sol";
import {AirdropToken} from "../src/AirdropToken.sol";
import {AirdropNFT} from "../src/AirdropNFT.sol";

contract Deploy is Script {
    uint256 internal constant ERC20_AIRDROP_SUPPLY = 1_000_000 ether;
    uint256 internal constant ERC721_INITIAL_TOKEN_ID = 1;

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address signer = vm.envAddress("SIGNER_ADDRESS");
        address owner = vm.addr(deployerPk);

        console2.log("========================================");
        console2.log(" Signature Airdrop Deployment");
        console2.log("========================================");
        console2.log("Chain ID:         ", block.chainid);
        console2.log("Deployer/Owner:   ", owner);
        console2.log("Backend Signer:   ", signer);
        console2.log("Deployer balance: ", owner.balance);
        console2.log("----------------------------------------");

        vm.startBroadcast(deployerPk);

        console2.log("[1/7] Deploying SignatureAirdrop...");
        SignatureAirdrop airdrop = new SignatureAirdrop(owner, signer);
        console2.log("      SignatureAirdrop:", address(airdrop));
        console2.log("      Contract owner:  ", airdrop.owner());
        console2.log("      Contract signer: ", airdrop.signer());

        console2.log("[2/7] Deploying ERC20 test token...");
        AirdropToken token = new AirdropToken(owner);
        console2.log("      AirdropToken:    ", address(token));
        console2.log("      Token name:      ", token.name());
        console2.log("      Token symbol:    ", token.symbol());
        console2.log("      Token owner:     ", token.owner());

        console2.log("[3/7] Deploying ERC721 test NFT...");
        AirdropNFT nft = new AirdropNFT(owner, "ipfs://nouns-signature-drop/");
        console2.log("      AirdropNFT:      ", address(nft));
        console2.log("      NFT name:        ", nft.name());
        console2.log("      NFT symbol:      ", nft.symbol());
        console2.log("      NFT owner:       ", nft.owner());

        console2.log("[4/7] Funding airdrop with ERC20 supply...");
        token.mint(address(airdrop), ERC20_AIRDROP_SUPPLY);
        console2.log("      Minted amount:   ", ERC20_AIRDROP_SUPPLY);
        console2.log("      Airdrop balance: ", token.balanceOf(address(airdrop)));

        console2.log("[5/7] Transferring NFT ownership to airdrop contract...");
        nft.transferOwnership(address(airdrop));
        console2.log("      NFT new owner:   ", nft.owner());

        console2.log("[6/7] Configuring rounds...");
        airdrop.configureRound(1, address(token), SignatureAirdrop.TokenType.ERC20, true, 0);
        console2.log("      Round 1: ERC20 active=true token=", address(token));

        airdrop.configureRound(2, address(nft), SignatureAirdrop.TokenType.ERC721, true, ERC721_INITIAL_TOKEN_ID);
        console2.log("      Round 2: ERC721 active=true token=", address(nft));
        console2.log("      Round 2 nextTokenId:", ERC721_INITIAL_TOKEN_ID);

        console2.log("[7/7] Setting current round...");
        airdrop.setCurrentRound(1);
        console2.log("      Current round:   ", airdrop.currentRound());

        vm.stopBroadcast();

        console2.log("----------------------------------------");
        console2.log("Deployment complete");
        console2.log("----------------------------------------");
        console2.log("SIGNATURE_AIRDROP_ADDRESS=", address(airdrop));
        console2.log("AIRDROP_TOKEN_ADDRESS=", address(token));
        console2.log("AIRDROP_NFT_ADDRESS=", address(nft));
        console2.log("----------------------------------------");
        console2.log("Update backend/.env:");
        console2.log("AIRDROP_CONTRACT_ADDRESS=", address(airdrop));
        console2.log("----------------------------------------");
        console2.log("Update frontend/.env.local:");
        console2.log("VITE_AIRDROP_CONTRACT_ADDRESS=", address(airdrop));
        console2.log("========================================");
    }
}
