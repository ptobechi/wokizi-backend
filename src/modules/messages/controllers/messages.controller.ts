import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MessagesService } from '../services/messages.service';
import { SendMessageDto } from '../dto/requests/send-message.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get messages in a conversation' })
  findAll(
    @CurrentUser('id') userId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('page') page: number, @Query('limit') limit: number,
  ) {
    return this.messagesService.findByConversation(userId, conversationId, page, limit);
  }

  @Post()
  @ApiOperation({ summary: 'Send a message' })
  send(
    @CurrentUser('id') userId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.send(userId, conversationId, dto);
  }
}

@ApiTags('Messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('messages')
export class MessagesRootController {
  constructor(private messagesService: MessagesService) {}

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a message' })
  delete(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.messagesService.delete(userId, id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread message count' })
  unreadCount(@CurrentUser('id') userId: string) {
    return this.messagesService.getUnreadCount(userId);
  }
}
