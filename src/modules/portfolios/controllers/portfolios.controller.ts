import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortfoliosService } from '../services/portfolios.service';
import { CreatePortfolioItemDto } from '../dto/requests/create-portfolio-item.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Portfolios')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('portfolios')
export class PortfoliosController {
  constructor(private portfoliosService: PortfoliosService) {}

  @Get('me')
  getMyItems(@CurrentUser('id') userId: string, @Query('serviceId') serviceId: string) {
    return this.portfoliosService.getItems(userId, serviceId);
  }

  @Post('items')
  addItem(@CurrentUser('id') userId: string, @Body() dto: CreatePortfolioItemDto) {
    return this.portfoliosService.addItem(userId, dto);
  }

  @Delete('items/:id')
  removeItem(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.portfoliosService.removeItem(id, userId);
  }

  @Public()
  @Get('users/:userId')
  @ApiOperation({ summary: 'Get public portfolio for a user' })
  getPublic(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.portfoliosService.getPublicPortfolio(userId);
  }
}
