import { Module } from '@nestjs/common';
import { MessagesService } from './services/messages.service';
import { MessagesController, MessagesRootController } from './controllers/messages.controller';
import { MessagesRepository } from './repositories/messages.repository';
import { MessagesGateway } from './gateways/messages.gateway';
import { ConversationsModule } from '../conversations/conversations.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConversationsModule, AuthModule],
  controllers: [MessagesController, MessagesRootController],
  providers: [MessagesService, MessagesRepository, MessagesGateway],
  exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
