import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { QuotationsService } from '../services/quotations.service';
import { CreateQuotationDto, RespondQuotationDto } from '../dto/requests/create-quotation.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Quotations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('quotations')
export class QuotationsController {
  constructor(private quotationsService: QuotationsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateQuotationDto) {
    return this.quotationsService.create(userId, dto);
  }

  @Post(':id/revise')
  revise(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string, @Body() dto: CreateQuotationDto) {
    return this.quotationsService.revise(id, userId, dto);
  }

  @Post(':id/respond')
  respond(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string, @Body() dto: RespondQuotationDto) {
    return this.quotationsService.respond(id, userId, dto);
  }

  @Get('conversations/:conversationId')
  getByConversation(@Param('conversationId', ParseUUIDPipe) conversationId: string, @CurrentUser('id') userId: string) {
    return this.quotationsService.getConversationQuotations(conversationId, userId);
  }

  @Get('me')
  @ApiQuery({ name: 'role', enum: ['provider', 'customer'], required: false })
  getMine(@CurrentUser('id') userId: string, @Query('role') role: 'provider' | 'customer', @Query('page') page: number, @Query('limit') limit: number) {
    return this.quotationsService.getMyQuotations(userId, role || 'customer', page, limit);
  }
}
