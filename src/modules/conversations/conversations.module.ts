import { Module } from '@nestjs/common';
import { ConversationsService } from './services/conversations.service';
import { ConversationsController } from './controllers/conversations.controller';
import { ConversationsRepository } from './repositories/conversations.repository';

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationsRepository],
  exports: [ConversationsService, ConversationsRepository],
})
export class ConversationsModule {}
