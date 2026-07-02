import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { WhitelistService } from '../whitelist/whitelist.service';

const AIRDROP_ABI = [
  'function claimed(uint256 round, uint8 tokenType, address user) view returns (bool)',
  'function currentRound() view returns (uint256)',
] as const;

@Injectable()
export class SignService {
  private readonly wallet: ethers.Wallet;
  private readonly provider: ethers.JsonRpcProvider;
  private readonly chainId: bigint;
  private readonly contractAddress: string;

  constructor(private readonly config: ConfigService, private readonly whitelist: WhitelistService) {
    const privateKey = this.config.get<string>('SIGNER_PRIVATE_KEY');
    if (!privateKey || privateKey.includes('0000000000000000000000000000000000000000000000000000000000000000')) {
      throw new Error('SIGNER_PRIVATE_KEY must be configured with the backend signer private key');
    }
    this.provider = new ethers.JsonRpcProvider(this.config.get<string>('RPC_URL', 'https://sepolia.base.org'));
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.chainId = BigInt(this.config.get<string | number>('CHAIN_ID', 84532));
    this.contractAddress = ethers.getAddress(this.config.get<string>('AIRDROP_CONTRACT_ADDRESS', ethers.ZeroAddress));
  }

  health() {
    return { ok: true, signer: this.wallet.address, chainId: this.chainId.toString(), contractAddress: this.contractAddress };
  }

  async checkEligibility(address: string, round: number) {
    const normalized = ethers.getAddress(address);
    const entry = this.whitelist.getEntry(normalized, round);
    if (!entry) return { eligible: false, round, claimed: false };
    const claimed = await this.isClaimed(normalized, round, entry.tokenType);
    return { eligible: true, round, tokenType: entry.tokenTypeName, amountOrTokenId: entry.amountOrTokenId, nonce: entry.nonce, claimed };
  }

  async sign(address: string, round: number) {
    this.assertContractConfigured();
    const normalized = ethers.getAddress(address);
    const entry = this.whitelist.getEntry(normalized, round);
    if (!entry) throw new BadRequestException({ eligible: false, message: 'Address is not eligible for this round' });
    const claimed = await this.isClaimed(normalized, round, entry.tokenType);
    if (claimed) throw new BadRequestException({ eligible: true, claimed: true, message: 'Already claimed for this round' });

    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
      [normalized, round, entry.amountOrTokenId, entry.nonce, this.contractAddress, this.chainId]
    );
    const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));
    return { eligible: true, round, tokenType: entry.tokenTypeName, amountOrTokenId: entry.amountOrTokenId, nonce: entry.nonce, signature, contractAddress: this.contractAddress, chainId: this.chainId.toString() };
  }

  private async isClaimed(address: string, round: number, tokenType: number): Promise<boolean> {
    if (this.contractAddress === ethers.ZeroAddress) return false;
    try {
      const contract = new ethers.Contract(this.contractAddress, AIRDROP_ABI, this.provider);
      return Boolean(await contract.claimed(round, tokenType, address));
    } catch (error) {
      console.warn('Claim status check failed, returning false:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  private assertContractConfigured() {
    if (this.contractAddress === ethers.ZeroAddress) {
      throw new BadRequestException({ message: 'AIRDROP_CONTRACT_ADDRESS is not configured on the backend' });
    }
  }
}
