// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AirdropNFT is ERC721, Ownable {
    string private _baseTokenURI;

    constructor(address initialOwner, string memory baseTokenURI)
        ERC721("Nouns Signature Drop", "NSD")
        Ownable(initialOwner)
    {
        _baseTokenURI = baseTokenURI;
    }

    function safeMint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
    }

    function setBaseURI(string calldata baseTokenURI) external onlyOwner {
        _baseTokenURI = baseTokenURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
