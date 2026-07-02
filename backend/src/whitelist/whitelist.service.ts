import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WhitelistEntry {
  address: string;
  round: number;
  amountOrTokenId: string;
  nonce: number;
  tokenType: number;
  tokenTypeName: 'ERC20' | 'ERC721';
}

type RawWhitelist = Record<string, { tokenType: 'ERC20' | 'ERC721'; token: string; recipients: Record<string, string> }>;

@Injectable()
export class WhitelistService {
  private readonly entries = new Map<string, WhitelistEntry>();

  constructor(private readonly config: ConfigService) {
    this.load();
  }

  getEntry(address: string, round: number): WhitelistEntry | undefined {
    return this.entries.get(`${ethers.getAddress(address).toLowerCase()}:${round}`);
  }

  private load() {
    const whitelistPath = path.resolve(process.cwd(), this.config.get<string>('WHITELIST_PATH', './whitelist.json'));
    const raw = JSON.parse(fs.readFileSync(whitelistPath, 'utf8')) as RawWhitelist;
    for (const [roundKey, config] of Object.entries(raw)) {
      const round = Number(roundKey);
      const tokenType = config.tokenType === 'ERC721' ? 1 : 0;
      let index = 0;
      for (const [address, amountOrTokenId] of Object.entries(config.recipients)) {
        const normalized = ethers.getAddress(address);
        this.entries.set(`${normalized.toLowerCase()}:${round}`, { address: normalized, round, amountOrTokenId, nonce: round * 1_000_000 + index, tokenType, tokenTypeName: config.tokenType });
        index += 1;
      }
    }
    console.log(`Loaded ${this.entries.size} whitelist entries`);
  }
}
