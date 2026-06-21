import { Module } from '@nestjs/common';
import { WithdrawalsService } from './services/withdrawals.service';
import { WithdrawalsController } from './controllers/withdrawals.controller';
import { WalletModule } from '../wallet/wallet.module';
import { PaystackModule } from '../../integrations/paystack/paystack.module';

@Module({
  imports:     [WalletModule, PaystackModule],
  providers:   [WithdrawalsService],
  controllers: [WithdrawalsController],
  exports:     [WithdrawalsService],
})
export class WithdrawalsModule {}
