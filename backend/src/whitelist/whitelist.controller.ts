import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { IsEthereumAddress, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { WhitelistService } from './whitelist.service';

export class AddWhitelistDto {
  @IsEthereumAddress()
  address!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  round?: number;

  @IsOptional()
  @IsString()
  amountOrTokenId?: string;

  @IsOptional()
  tokenType?: 'ERC20' | 'ERC721';
}

export class RemoveWhitelistDto {
  @IsEthereumAddress()
  address!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  round?: number;
}

@Controller('whitelist')
export class WhitelistController {
  constructor(private readonly whitelist: WhitelistService) {}

  @Get()
  list(@Query('round') round?: string) {
    const entries = this.whitelist.getAllEntries(round ? Number(round) : undefined);
    return { count: entries.length, entries };
  }

  @Get(':address')
  getForAddress(
    @Param('address') address: string,
    @Query('round') round?: string,
  ) {
    const roundNum = round ? Number(round) : undefined;
    if (roundNum === undefined) {
      const all = this.whitelist.getAllEntries().filter((e) => e.address.toLowerCase() === address.toLowerCase());
      return { count: all.length, entries: all };
    }
    const entry = this.whitelist.getEntry(address, roundNum);
    return entry ? { entry } : { entry: null };
  }

  @Post()
  add(@Body() body: AddWhitelistDto) {
    const round = body.round ?? 1;
    const tokenType = body.tokenType ?? (round === 1 ? 'ERC20' : 'ERC721');
    const defaultAmount = round === 1 ? '100000000000000000000' : '1';
    const entry = this.whitelist.addEntry(body.address, round, body.amountOrTokenId ?? defaultAmount, tokenType);
    return { added: true, entry };
  }

  @Post('join')
  join(@Body() body: AddWhitelistDto) {
    const round = body.round ?? 1;
    const tokenType = body.tokenType ?? (round === 1 ? 'ERC20' : 'ERC721');
    const defaultAmount = round === 1 ? '100000000000000000000' : '1';
    const entry = this.whitelist.addEntry(body.address, round, body.amountOrTokenId ?? defaultAmount, tokenType);
    return { joined: true, entry };
  }

  @Delete()
  remove(@Body() body: RemoveWhitelistDto) {
    const round = body.round ?? 1;
    const removed = this.whitelist.removeEntry(body.address, round);
    return { removed };
  }
}
