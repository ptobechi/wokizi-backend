import { Module } from '@nestjs/common';
import { DisputesService } from './services/disputes.service';
import { DisputesController } from './controllers/disputes.controller';
import { DisputesRepository } from './repositories/disputes.repository';

@Module({
  controllers: [DisputesController],
  providers: [DisputesService, DisputesRepository],
  exports: [DisputesService],
})
export class DisputesModule {}
