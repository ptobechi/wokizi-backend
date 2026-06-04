import { Module } from '@nestjs/common';
import { QuotationsService } from './services/quotations.service';
import { QuotationsController } from './controllers/quotations.controller';
import { QuotationsRepository } from './repositories/quotations.repository';

@Module({
  controllers: [QuotationsController],
  providers: [QuotationsService, QuotationsRepository],
  exports: [QuotationsService],
})
export class QuotationsModule {}
