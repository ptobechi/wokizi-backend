import { Module } from '@nestjs/common';
import { ServiceListingsService } from './services/service-listings.service';
import { ServicesController } from './controllers/services.controller';
import { ServicesRepository } from './repositories/services.repository';

@Module({
  controllers: [ServicesController],
  providers: [ServiceListingsService, ServicesRepository],
  exports: [ServiceListingsService, ServicesRepository],
})
export class ServicesModule {}
