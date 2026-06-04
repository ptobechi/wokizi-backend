import { IsEnum, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType, MediaType } from '@prisma/client';

export class SendMessageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiProperty({ enum: MessageType, default: MessageType.TEXT }) @IsEnum(MessageType) type: MessageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  media?: { url: string; thumbnailUrl?: string; mediaType: MediaType; fileName?: string; fileSize?: number; mimeType?: string }[];
}
