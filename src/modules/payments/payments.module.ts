import { Module } from '@nestjs/common';
import { PaymentsService } from './services/payments.service';
import { PaymentsController } from './controllers/payments.controller';
import { WalletModule } from '../wallet/wallet.module';
import { PaystackModule } from '../../integrations/paystack/paystack.module';

@Module({
  imports:     [WalletModule, PaystackModule],
  providers:   [PaymentsService],
  controllers: [PaymentsController],
  exports:     [PaymentsService],
})
export class PaymentsModule {}
