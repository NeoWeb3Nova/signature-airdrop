import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SignModule } from './sign/sign.module';
import { WhitelistModule } from './whitelist/whitelist.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), WhitelistModule, SignModule],
})
export class AppModule {}
