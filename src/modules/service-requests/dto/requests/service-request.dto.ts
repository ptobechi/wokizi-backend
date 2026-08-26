import {
  IsString, IsNumber, IsOptional, Min, IsArray, ArrayMaxSize, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceRequestDto {
  @ApiProperty() @IsString() serviceId: string;
  @ApiProperty() @MaxLength(2000) @IsString() description: string;
  @ApiProperty() @IsString() address: string;
  @ApiProperty() @IsNumber() @Type(() => Number) latitude: number;
  @ApiProperty() @IsNumber() @Type(() => Number) longitude: number;
  @ApiPropertyOptional() @IsOptional() @IsString() savedAddressId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Already-uploaded image URLs (max 8)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  images?: string[];
}

export class DeclineServiceRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class AdjustPriceDto {
  @ApiPropertyOptional({ description: 'Omit to accept at the base price' })
  @IsOptional() @IsNumber() @Min(0.01) @Type(() => Number) price?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
