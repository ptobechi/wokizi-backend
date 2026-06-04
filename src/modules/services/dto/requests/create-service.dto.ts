import {
  IsString, IsOptional, IsNumber, IsBoolean,
  Min, Max, IsArray, MaxLength, ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ServiceImageDto {
  @IsString() url: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsString() caption?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class AvailabilitySlotDto {
  @IsNumber() @Min(0) @Max(6) dayOfWeek: number;
  @IsString() startTime: string;
  @IsString() endTime: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

export class CreateServiceDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() @MaxLength(2000) description: string;
  @ApiProperty() @IsString() categoryId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subcategoryId?: string;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) startingPrice: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) maxPrice?: number;
  @ApiPropertyOptional({ default: 10 }) @IsOptional() @IsNumber() @Min(1) @Max(500) @Type(() => Number) serviceRadius?: number;

  @ApiPropertyOptional({ type: [ServiceImageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceImageDto)
  images?: ServiceImageDto[];

  @ApiPropertyOptional({ type: [AvailabilitySlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  availabilitySlots?: AvailabilitySlotDto[];
}

export class UpdateServiceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) startingPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) maxPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(500) @Type(() => Number) serviceRadius?: number;
}
