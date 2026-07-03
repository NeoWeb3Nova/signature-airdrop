import { Module } from '@nestjs/common';
import { WhitelistService } from './whitelist.service';
import { WhitelistController } from './whitelist.controller';

@Module({ providers: [WhitelistService], exports: [WhitelistService], controllers: [WhitelistController] })
export class WhitelistModule {}
