import { Module } from '@nestjs/common';
import { AwsModule } from './aws/aws.module';
import { FirebaseModule } from './firebase/firebase.module';
import { ResendModule } from './resend/resend.module';
import { SmsModule } from './sms/sms.module';

@Module({
  imports: [AwsModule, FirebaseModule, ResendModule, SmsModule],
  exports: [AwsModule, FirebaseModule, ResendModule, SmsModule],
})
export class IntegrationsModule {}
