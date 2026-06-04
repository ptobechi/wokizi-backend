import { Module } from '@nestjs/common';
import { SavedServicesService } from './services/saved-services.service';
import { SavedServicesController } from './controllers/saved-services.controller';

@Module({ controllers: [SavedServicesController], providers: [SavedServicesService], exports: [SavedServicesService] })
export class SavedServicesModule {}
