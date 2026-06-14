import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupportTicketCategory } from '@prisma/client';

export class CreateTicketDto {
  @ApiProperty({ enum: SupportTicketCategory })
  @IsEnum(SupportTicketCategory)
  category: SupportTicketCategory;

  @ApiProperty({ example: 'Payment not reflected in wallet' })
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  subject: string;

  @ApiProperty({ example: 'I made a payment 2 hours ago but...' })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  message: string;
}
