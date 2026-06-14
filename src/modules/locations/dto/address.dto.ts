import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum AddressLabel {
  HOME   = 'HOME',
  OFFICE = 'OFFICE',
  OTHER  = 'OTHER',
}

export class CreateAddressDto {
  @ApiProperty({ enum: AddressLabel, default: AddressLabel.OTHER })
  @IsEnum(AddressLabel)
  label: AddressLabel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  address: string;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  longitude: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @ApiPropertyOptional({ enum: AddressLabel })
  @IsOptional()
  @IsEnum(AddressLabel)
  label?: AddressLabel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
