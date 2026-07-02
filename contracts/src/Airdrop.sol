// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IAirdropNFT {
    function safeMint(address to, uint256 tokenId) external;
}

contract SignatureAirdrop is Ownable, Pausable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    enum TokenType {
        ERC20,
        ERC721
    }

    struct RoundConfig {
        address token;
        TokenType tokenType;
        bool active;
        uint256 nextTokenId;
    }

    address public signer;
    uint256 public currentRound;

    mapping(uint256 => RoundConfig) public rounds;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public claimed;

    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event RoundConfigured(
        uint256 indexed round, address indexed token, TokenType tokenType, bool active, uint256 nextTokenId
    );
    event RoundStatusUpdated(uint256 indexed round, bool active);
    event CurrentRoundUpdated(uint256 indexed round);
    event Claimed(
        uint256 indexed round, address indexed recipient, TokenType tokenType, uint256 amountOrTokenId, uint256 nonce
    );

    error InvalidSigner();
    error InvalidToken();
    error InvalidRound();
    error RoundNotActive();
    error AlreadyClaimed();
    error InvalidSignature();
    error InvalidAmount();

    constructor(address initialOwner, address initialSigner) Ownable(initialOwner) {
        if (initialSigner == address(0)) revert InvalidSigner();
        signer = initialSigner;
    }

    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert InvalidSigner();
        emit SignerUpdated(signer, newSigner);
        signer = newSigner;
    }

    function configureRound(uint256 round, address token, TokenType tokenType, bool active, uint256 nextTokenId)
        external
        onlyOwner
    {
        if (round == 0) revert InvalidRound();
        if (token == address(0)) revert InvalidToken();
        rounds[round] = RoundConfig({token: token, tokenType: tokenType, active: active, nextTokenId: nextTokenId});
        emit RoundConfigured(round, token, tokenType, active, nextTokenId);
    }

    function setRoundActive(uint256 round, bool active) external onlyOwner {
        if (rounds[round].token == address(0)) revert InvalidRound();
        rounds[round].active = active;
        emit RoundStatusUpdated(round, active);
    }

    function setCurrentRound(uint256 round) external onlyOwner {
        if (rounds[round].token == address(0)) revert InvalidRound();
        currentRound = round;
        emit CurrentRoundUpdated(round);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function claim(uint256 round, uint256 amountOrTokenId, uint256 nonce, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
    {
        RoundConfig storage config = rounds[round];
        if (config.token == address(0)) revert InvalidRound();
        if (!config.active) revert RoundNotActive();

        uint8 tokenTypeRaw = uint8(config.tokenType);
        if (claimed[round][tokenTypeRaw][msg.sender]) revert AlreadyClaimed();
        if (amountOrTokenId == 0) revert InvalidAmount();
        if (!_isValidSignature(msg.sender, round, amountOrTokenId, nonce, signature)) revert InvalidSignature();

        claimed[round][tokenTypeRaw][msg.sender] = true;

        if (config.tokenType == TokenType.ERC20) {
            IERC20(config.token).safeTransfer(msg.sender, amountOrTokenId);
            emit Claimed(round, msg.sender, config.tokenType, amountOrTokenId, nonce);
        } else {
            uint256 tokenId = config.nextTokenId;
            config.nextTokenId = tokenId + 1;
            IAirdropNFT(config.token).safeMint(msg.sender, tokenId);
            emit Claimed(round, msg.sender, config.tokenType, tokenId, nonce);
        }
    }

    function getMessageHash(address recipient, uint256 round, uint256 amountOrTokenId, uint256 nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(recipient, round, amountOrTokenId, nonce, address(this), block.chainid));
    }

    function getEthSignedMessageHash(address recipient, uint256 round, uint256 amountOrTokenId, uint256 nonce)
        public
        view
        returns (bytes32)
    {
        return MessageHashUtils.toEthSignedMessageHash(getMessageHash(recipient, round, amountOrTokenId, nonce));
    }

    function _isValidSignature(
        address recipient,
        uint256 round,
        uint256 amountOrTokenId,
        uint256 nonce,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes32 digest = getEthSignedMessageHash(recipient, round, amountOrTokenId, nonce);
        return ECDSA.recover(digest, signature) == signer;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
