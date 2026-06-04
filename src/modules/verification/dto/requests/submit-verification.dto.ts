import { IsArray, IsEnum, IsNumber, IsString, IsUrl, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { Type } from 'class-transformer';

export class VerificationDocumentDto {
  @IsEnum(DocumentType)
  documentType: DocumentType;

  // require_tld: false — accepts IP-based URLs (MinIO in local dev)
  @IsUrl({ require_tld: false })
  fileUrl: string;

  @IsString()
  fileName: string;

  @IsNumber()
  @Type(() => Number)
  fileSize: number;

  @IsString()
  mimeType: string;
}

export class SubmitVerificationDto {
  @ApiProperty({ type: [VerificationDocumentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentDto)
  documents: VerificationDocumentDto[];
}
