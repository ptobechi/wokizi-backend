import { IsEnum, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UploadPurpose } from '@prisma/client';

export class GetPresignedUrlDto {
  @ApiProperty() @IsString() fileName: string;
  @ApiProperty() @IsString() mimeType: string;
  @ApiProperty({ enum: UploadPurpose }) @IsEnum(UploadPurpose) purpose: UploadPurpose;
}

export class ConfirmUploadDto {
  @ApiProperty() @IsString() key: string;
  @ApiProperty() @IsString() fileName: string;
  @ApiProperty() @IsNumber() @Type(() => Number) fileSize: number;
  @ApiProperty() @IsString() mimeType: string;
  @ApiProperty({ enum: UploadPurpose }) @IsEnum(UploadPurpose) purpose: UploadPurpose;
}
