import { Module } from '@nestjs/common';
import { WhitelistService } from './whitelist.service';

@Module({ providers: [WhitelistService], exports: [WhitelistService] })
export class WhitelistModule {}
