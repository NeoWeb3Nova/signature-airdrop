import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173') });
  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  console.log(`Signature airdrop API listening on http://localhost:${port}/api`);
}
bootstrap();
