import { IsString, IsNumber, IsOptional, Min, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateQuotationDto {
  @ApiProperty() @IsString() conversationId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiProperty() @IsString() customerId: string;
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) labourCost: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) materialCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) transportationCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) additionalCharges?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) taxRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validUntil?: string;
}

export class RespondQuotationDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED', 'NEGOTIATING'] }) @IsString()
  action: 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING';

  @ApiPropertyOptional() @IsOptional() @IsString() rejectionReason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() message?: string;
}
