import { IsEnum, IsOptional, IsString, IsUrl, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreatePortfolioItemDto {
  @ApiProperty() @IsUrl() mediaUrl: string;
  @ApiProperty({ enum: MediaType }) @IsEnum(MediaType) mediaType: MediaType;
  @ApiPropertyOptional() @IsOptional() @IsUrl() thumbnailUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isBefore?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isAfter?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) sortOrder?: number;
}
