import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.AWS_S3_BUCKET || 'wokizi-media',
  endpoint: process.env.AWS_S3_ENDPOINT || undefined,
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
}));
