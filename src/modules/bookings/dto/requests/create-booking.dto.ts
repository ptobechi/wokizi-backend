import { IsString, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  // Exactly one of these two must be provided — validated in BookingsService,
  // not here, since a class-validator decorator can't express "exactly one of".
  @ApiPropertyOptional({ description: 'Book from an accepted Quotation (manual in-chat quote flow)' })
  @IsOptional() @IsString() quotationId?: string;

  @ApiPropertyOptional({ description: 'Book from an accepted ServiceRequest (direct request flow)' })
  @IsOptional() @IsString() serviceRequestId?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateBookingStatusDto {
  @ApiProperty({
    enum: ['CONFIRMED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'],
  })
  @IsString()
  status: 'CONFIRMED' | 'ACCEPTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'PARTIALLY_COMPLETED' | 'COMPLETED' | 'CANCELLED';

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cancelReason?: string;
}
