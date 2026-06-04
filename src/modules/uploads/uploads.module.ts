import { Module } from '@nestjs/common';
import { UploadsService } from './services/uploads.service';
import { UploadsController } from './controllers/uploads.controller';
import { AwsModule } from '../../integrations/aws/aws.module';

@Module({
  imports: [AwsModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
