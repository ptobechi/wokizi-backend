import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { AdminController } from './controllers/admin.controller';
import { WalletModule } from '../wallet/wallet.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';
import { PaymentsModule } from '../payments/payments.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports:     [WalletModule, WithdrawalsModule, PaymentsModule, BookingsModule],
  controllers: [AdminController],
  providers:   [AdminService],
  exports:     [AdminService],
})
export class AdminModule {}
