import { Module } from '@nestjs/common';
import { AwsModule } from './aws/aws.module';
import { FirebaseModule } from './firebase/firebase.module';
import { ExpoModule } from './expo/expo.module';
import { ResendModule } from './resend/resend.module';
import { SmsModule } from './sms/sms.module';
import { PaystackModule } from './paystack/paystack.module';

@Module({
  imports: [AwsModule, FirebaseModule, ExpoModule, ResendModule, SmsModule, PaystackModule],
  exports: [AwsModule, FirebaseModule, ExpoModule, ResendModule, SmsModule, PaystackModule],
})
export class IntegrationsModule {}
