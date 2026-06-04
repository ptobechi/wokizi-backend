import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UploadPurpose } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { AwsS3Service } from '../../../integrations/aws/aws-s3.service';

@Injectable()
export class UploadsService {
  constructor(private s3: AwsS3Service, private prisma: PrismaService) {}

  async getPresignedUploadUrl(userId: string, fileName: string, mimeType: string, purpose: UploadPurpose) {
    return this.s3.getPresignedUploadUrl(purpose.toLowerCase(), userId, fileName, mimeType);
  }

  async confirmUpload(userId: string, key: string, fileName: string, fileSize: number, mimeType: string, purpose: UploadPurpose) {
    const baseUrl = key.startsWith('http') ? key : `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
    return this.prisma.upload.create({ data: { userId, key, url: baseUrl, fileName, fileSize, mimeType, purpose } });
  }

  async deleteUpload(key: string, userId: string) {
    const upload = await this.prisma.upload.findFirst({ where: { key, userId } });
    if (!upload) throw new BadRequestException('Upload not found or access denied');
    await this.s3.deleteObject(key);
    await this.prisma.upload.delete({ where: { id: upload.id } });
    return { message: 'Deleted' };
  }
}
