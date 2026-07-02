import { Module } from '@nestjs/common';
import { SignController } from './sign.controller';
import { SignService } from './sign.service';
import { WhitelistModule } from '../whitelist/whitelist.module';

@Module({ imports: [WhitelistModule], controllers: [SignController], providers: [SignService] })
export class SignModule {}
