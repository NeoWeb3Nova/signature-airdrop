import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

const localDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

function buildCorsOriginChecker(config: ConfigService) {
  const configuredOrigins = (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || configuredOrigins.includes(origin) || localDevOriginPattern.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: buildCorsOriginChecker(config) });
  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  console.log(`Signature airdrop API listening on http://localhost:${port}/api`);
}
bootstrap();
