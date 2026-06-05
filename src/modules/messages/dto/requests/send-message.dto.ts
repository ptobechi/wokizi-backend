import { IsEnum, IsOptional, IsString, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType, MediaType } from '@prisma/client';

export class MessageMediaDto {
  @ApiProperty()       @IsString()                     url:          string;
  @ApiPropertyOptional() @IsOptional() @IsString()     thumbnailUrl?: string;
  @ApiProperty({ enum: MediaType }) @IsEnum(MediaType) mediaType:    MediaType;
  @ApiPropertyOptional() @IsOptional() @IsString()     fileName?:    string;
  @ApiPropertyOptional() @IsOptional() @IsNumber()     fileSize?:    number;
  @ApiPropertyOptional() @IsOptional() @IsString()     mimeType?:    string;
}

export class SendMessageDto {
  @ApiPropertyOptional() @IsOptional() @IsString()                         content?: string;
  @ApiProperty({ enum: MessageType, default: MessageType.TEXT })
  @IsEnum(MessageType)                                                       type:     MessageType;

  @ApiPropertyOptional({ type: [MessageMediaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageMediaDto)
                                                                             media?:  MessageMediaDto[];
}
