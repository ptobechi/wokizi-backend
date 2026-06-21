import {
  IsString, IsNumber, IsOptional, Min, IsDateString,
  IsEnum, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentType, QuotationItemType } from '@prisma/client';

export class QuotationItemDto {
  @ApiProperty({ enum: QuotationItemType })
  @IsEnum(QuotationItemType)
  type: QuotationItemType;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;
}

export class CreateQuotationDto {
  @ApiProperty() @IsString() conversationId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiProperty() @IsString() customerId: string;
  @ApiProperty() @IsString() description: string;

  // Line items (new shopping-cart mode)
  @ApiPropertyOptional({ type: [QuotationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items?: QuotationItemDto[];

  // Flat cost fields kept for backwards compat; ignored when items are provided
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) labourCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) materialCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) transportationCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) additionalCharges?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) taxRate?: number;
  @ApiPropertyOptional({ enum: PaymentType })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validUntil?: string;
}

export class RespondQuotationDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED', 'NEGOTIATING'] }) @IsString()
  action: 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING';

  @ApiPropertyOptional() @IsOptional() @IsString() rejectionReason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() message?: string;
}
