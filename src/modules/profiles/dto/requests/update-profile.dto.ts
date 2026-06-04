import { IsString, IsOptional, IsNumber, Min, Max, MaxLength, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200 })
  @IsOptional() @IsNumber() @Min(1) @Max(200) @Type(() => Number)
  travelRadius?: number;
}
