import { IsString, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty() @IsString() quotationId: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: ['ACCEPTED','SCHEDULED','IN_PROGRESS','PARTIALLY_COMPLETED','COMPLETED','CANCELLED'] })
  @IsString()
  status: 'ACCEPTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'PARTIALLY_COMPLETED' | 'COMPLETED' | 'CANCELLED';

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cancelReason?: string;
}
