import { Body, Controller, Delete, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UploadsService } from '../services/uploads.service';
import { GetPresignedUrlDto, ConfirmUploadDto } from '../dto/requests/upload.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Uploads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Get pre-signed S3 upload URL' })
  getPresignedUrl(@CurrentUser('id') userId: string, @Body() dto: GetPresignedUrlDto) {
    return this.uploadsService.getPresignedUploadUrl(userId, dto.fileName, dto.mimeType, dto.purpose);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm completed upload' })
  confirm(@CurrentUser('id') userId: string, @Body() dto: ConfirmUploadDto) {
    return this.uploadsService.confirmUpload(userId, dto.key, dto.fileName, dto.fileSize, dto.mimeType, dto.purpose);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete an upload' })
  delete(@CurrentUser('id') userId: string, @Query('key') key: string) {
    return this.uploadsService.deleteUpload(key, userId);
  }
}
