import { Module } from '@nestjs/common';
import { ServiceRequestsService } from './services/service-requests.service';
import { ServiceRequestsController } from './controllers/service-requests.controller';
import { ServiceRequestsRepository } from './repositories/service-requests.repository';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports:     [ConversationsModule],
  controllers: [ServiceRequestsController],
  providers:   [ServiceRequestsService, ServiceRequestsRepository],
  exports:     [ServiceRequestsService],
})
export class ServiceRequestsModule {}
