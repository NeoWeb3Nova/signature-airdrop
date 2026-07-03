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

export type RawWhitelist = Record<string, { tokenType: 'ERC20' | 'ERC721'; token: string; recipients: Record<string, string> }>;

@Injectable()
export class WhitelistService {
  private readonly entries = new Map<string, WhitelistEntry>();
  private readonly whitelistPath: string;
  private nextNonceBase = 1_000_000;

  constructor(private readonly config: ConfigService) {
    this.whitelistPath = path.resolve(process.cwd(), this.config.get<string>('WHITELIST_PATH', './whitelist.json'));
    this.load();
  }

  getEntry(address: string, round: number): WhitelistEntry | undefined {
    return this.entries.get(`${ethers.getAddress(address).toLowerCase()}:${round}`);
  }

  getAllEntries(round?: number): WhitelistEntry[] {
    const all = Array.from(this.entries.values());
    return round === undefined ? all : all.filter((e) => e.round === round);
  }

  addEntry(address: string, round: number, amountOrTokenId: string, tokenTypeName: 'ERC20' | 'ERC721' = 'ERC20'): WhitelistEntry {
    const normalized = ethers.getAddress(address);
    const key = `${normalized.toLowerCase()}:${round}`;
    if (this.entries.has(key)) {
      const existing = this.entries.get(key)!;
      // Update amount if different
      if (existing.amountOrTokenId !== amountOrTokenId) {
        existing.amountOrTokenId = amountOrTokenId;
        this.save();
      }
      return existing;
    }
    const tokenType = tokenTypeName === 'ERC721' ? 1 : 0;
    const roundMaxNonce = Array.from(this.entries.values())
      .filter((e) => e.round === round)
      .reduce((max, e) => (e.nonce > max ? e.nonce : max), round * this.nextNonceBase);
    const nonce = roundMaxNonce + 1;
    const entry: WhitelistEntry = {
      address: normalized,
      round,
      amountOrTokenId,
      nonce,
      tokenType,
      tokenTypeName,
    };
    this.entries.set(key, entry);
    this.save();
    return entry;
  }

  removeEntry(address: string, round: number): boolean {
    const normalized = ethers.getAddress(address);
    const key = `${normalized.toLowerCase()}:${round}`;
    const removed = this.entries.delete(key);
    if (removed) this.save();
    return removed;
  }

  private load() {
    if (!fs.existsSync(this.whitelistPath)) {
      console.log('Whitelist file not found, starting with empty whitelist');
      return;
    }
    const raw = JSON.parse(fs.readFileSync(this.whitelistPath, 'utf8')) as RawWhitelist;
    for (const [roundKey, config] of Object.entries(raw)) {
      const round = Number(roundKey);
      const tokenType = config.tokenType === 'ERC721' ? 1 : 0;
      let index = 0;
      for (const [addr, amountOrTokenId] of Object.entries(config.recipients)) {
        const normalized = ethers.getAddress(addr);
        this.entries.set(`${normalized.toLowerCase()}:${round}`, {
          address: normalized,
          round,
          amountOrTokenId,
          nonce: round * this.nextNonceBase + index,
          tokenType,
          tokenTypeName: config.tokenType,
        });
        index += 1;
      }
    }
    console.log(`Loaded ${this.entries.size} whitelist entries from ${this.whitelistPath}`);
  }

  private save() {
    const raw: RawWhitelist = {};
    for (const entry of this.entries.values()) {
      if (!raw[entry.round]) {
        raw[entry.round] = {
          tokenType: entry.tokenTypeName,
          token: entry.tokenTypeName === 'ERC721'
            ? this.config.get<string>(`TOKEN_${entry.round}_ERC721`, ethers.ZeroAddress)
            : this.config.get<string>(`TOKEN_${entry.round}_ERC20`, ethers.ZeroAddress),
          recipients: {},
        };
      }
      raw[entry.round].recipients[entry.address] = entry.amountOrTokenId;
    }
    fs.writeFileSync(this.whitelistPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
    console.log(`Saved ${this.entries.size} whitelist entries to ${this.whitelistPath}`);
  }
}
