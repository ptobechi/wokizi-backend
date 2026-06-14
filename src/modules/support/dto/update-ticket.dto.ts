import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupportTicketStatus } from '@prisma/client';

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: SupportTicketStatus })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ example: 'We have resolved this issue.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
