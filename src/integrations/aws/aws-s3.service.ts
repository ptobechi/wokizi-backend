import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  'application/pdf',
]);

@Injectable()
export class AwsS3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly endpoint?: string;
  private readonly publicBaseUrl?: string;
  private readonly logger = new Logger(AwsS3Service.name);

  constructor(private configService: ConfigService) {
    this.bucket = configService.get<string>('storage.bucket', 'wokizi-media');
    this.endpoint = configService.get<string>('storage.endpoint');
    this.publicBaseUrl = configService.get<string>('storage.publicUrl');

    this.s3 = new S3Client({
      region: configService.get<string>('storage.region', 'us-east-1'),
      credentials: {
        accessKeyId: configService.get<string>('storage.accessKeyId', ''),
        secretAccessKey: configService.get<string>('storage.secretAccessKey', ''),
      },
      ...(this.endpoint ? { endpoint: this.endpoint, forcePathStyle: true } : {}),
    });
  }

  async getPresignedUploadUrl(
    folder: string,
    userId: string,
    fileName: string,
    mimeType: string,
    expiresIn = 300,
  ): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(`File type '${mimeType}' is not allowed`);
    }

    const ext = fileName.split('.').pop();
    const key = `${folder}/${userId}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });

    return { uploadUrl, fileUrl: this.getPublicUrl(key), key };
  }

  getPublicUrl(key: string): string {
    if (this.publicBaseUrl) return `${this.publicBaseUrl}/${key}`;
    return this.endpoint
      ? `${this.endpoint}/${this.bucket}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log(`Deleted S3 object: ${key}`);
  }
}
