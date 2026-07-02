// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SignatureAirdrop} from "../src/Airdrop.sol";
import {AirdropToken} from "../src/AirdropToken.sol";
import {AirdropNFT} from "../src/AirdropNFT.sol";

contract AirdropTest is Test {
    SignatureAirdrop public airdrop;
    AirdropToken public token;
    AirdropNFT public nft;

    uint256 internal signerPk = 0xA11CE;
    address internal signer;
    address internal owner = address(0xBEEF);
    address internal alice = address(0xA1);
    address internal bob = address(0xB0B);

    function setUp() public {
        signer = vm.addr(signerPk);
        vm.startPrank(owner);
        airdrop = new SignatureAirdrop(owner, signer);
        token = new AirdropToken(owner);
        nft = new AirdropNFT(owner, "ipfs://nouns/");

        token.mint(address(airdrop), 1_000_000 ether);
        nft.transferOwnership(address(airdrop));

        airdrop.configureRound(1, address(token), SignatureAirdrop.TokenType.ERC20, true, 0);
        airdrop.configureRound(2, address(nft), SignatureAirdrop.TokenType.ERC721, true, 1);
        airdrop.setCurrentRound(1);
        vm.stopPrank();
    }

    function _signature(address recipient, uint256 round, uint256 amountOrTokenId, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = airdrop.getEthSignedMessageHash(recipient, round, amountOrTokenId, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testClaimERC20() public {
        uint256 amount = 100 ether;
        bytes memory sig = _signature(alice, 1, amount, 7);

        vm.prank(alice);
        airdrop.claim(1, amount, 7, sig);

        assertEq(token.balanceOf(alice), amount);
        assertTrue(airdrop.claimed(1, 0, alice));
    }

    function testRejectReplayClaim() public {
        uint256 amount = 100 ether;
        bytes memory sig = _signature(alice, 1, amount, 7);

        vm.prank(alice);
        airdrop.claim(1, amount, 7, sig);

        vm.prank(alice);
        vm.expectRevert(SignatureAirdrop.AlreadyClaimed.selector);
        airdrop.claim(1, amount, 7, sig);
    }

    function testRejectWrongRecipient() public {
        uint256 amount = 100 ether;
        bytes memory sig = _signature(alice, 1, amount, 7);

        vm.prank(bob);
        vm.expectRevert(SignatureAirdrop.InvalidSignature.selector);
        airdrop.claim(1, amount, 7, sig);
    }

    function testRejectWrongNonce() public {
        uint256 amount = 100 ether;
        bytes memory sig = _signature(alice, 1, amount, 7);

        vm.prank(alice);
        vm.expectRevert(SignatureAirdrop.InvalidSignature.selector);
        airdrop.claim(1, amount, 8, sig);
    }

    function testClaimERC721WithIncrementingTokenId() public {
        bytes memory sigAlice = _signature(alice, 2, 1, 11);
        bytes memory sigBob = _signature(bob, 2, 1, 12);

        vm.prank(alice);
        airdrop.claim(2, 1, 11, sigAlice);

        vm.prank(bob);
        airdrop.claim(2, 1, 12, sigBob);

        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.ownerOf(2), bob);
        (,,, uint256 nextTokenId) = airdrop.rounds(2);
        assertEq(nextTokenId, 3);
    }

    function testOnlyOwnerCanConfigureRound() public {
        vm.prank(alice);
        vm.expectRevert();
        airdrop.configureRound(3, address(token), SignatureAirdrop.TokenType.ERC20, true, 0);
    }

    function testPauseBlocksClaim() public {
        vm.prank(owner);
        airdrop.pause();

        bytes memory sig = _signature(alice, 1, 100 ether, 1);
        vm.prank(alice);
        vm.expectRevert();
        airdrop.claim(1, 100 ether, 1, sig);
    }
}
