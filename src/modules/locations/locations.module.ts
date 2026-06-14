import { Module } from '@nestjs/common';
import { LocationsService } from './services/locations.service';
import { AddressesService } from './services/addresses.service';
import { TrackingService } from './services/tracking.service';
import { LocationsController } from './controllers/locations.controller';
import { AddressesController } from './controllers/addresses.controller';
import { TrackingController } from './controllers/tracking.controller';

@Module({
  controllers: [LocationsController, AddressesController, TrackingController],
  providers: [LocationsService, AddressesService, TrackingService],
  exports: [LocationsService, AddressesService, TrackingService],
})
export class LocationsModule {}
