import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsEthereumAddress, IsInt, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { SignService } from './sign.service';

export class SignRequestDto {
  @IsEthereumAddress()
  address!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  round?: number;
}

export class EligibilityQueryDto {
  @IsEthereumAddress()
  address!: string;

  @IsOptional()
  @Transform(({ value }) => value === undefined ? undefined : Number(value))
  @IsInt()
  @Min(1)
  round?: number;
}

@Controller()
export class SignController {
  constructor(private readonly signService: SignService) {}

  @Get('health')
  health() {
    return this.signService.health();
  }

  @Get('eligibility')
  eligibility(@Query() query: EligibilityQueryDto) {
    return this.signService.checkEligibility(query.address, query.round ?? 1);
  }

  @Post('sign')
  sign(@Body() body: SignRequestDto) {
    return this.signService.sign(body.address, body.round ?? 1);
  }
}
