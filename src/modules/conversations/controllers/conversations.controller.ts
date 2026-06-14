import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConversationsService, CreateConversationDto } from '../services/conversations.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('conversations')
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Start or get a conversation' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateConversationDto) {
    return this.conversationsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my conversations' })
  findAll(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.conversationsService.findAll(userId, page, limit);
  }

  @Get('archived')
  @ApiOperation({ summary: 'List archived conversations' })
  findArchived(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.conversationsService.findAllArchived(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single conversation' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.conversationsService.findById(id, userId);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a conversation (end service request)' })
  archive(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.conversationsService.archive(id, userId);
  }
}
