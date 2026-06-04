import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDisputeDto {
  @ApiProperty() @IsString() bookingId: string;
  @ApiProperty() @IsString() reason: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray()
  evidence?: { fileUrl: string; fileName: string; fileSize: number; mimeType: string; description?: string }[];
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: ['RESOLVED', 'REJECTED'] }) @IsString() outcome: 'RESOLVED' | 'REJECTED';
  @ApiProperty() @IsString() resolution: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adminNotes?: string;
}
