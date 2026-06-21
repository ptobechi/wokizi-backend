import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentOrderDto {
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @IsUUID()
  quotationId: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;
}

export class CapturePaymentDto {
  @IsString()
  orderId: string;

  @IsOptional()
  @IsString()
  payerId?: string;
}
