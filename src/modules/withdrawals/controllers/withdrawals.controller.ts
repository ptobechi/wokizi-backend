import { Body, Controller, Get, Query, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { WithdrawalsService } from '../services/withdrawals.service';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';

@ApiTags('Withdrawals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private withdrawalsService: WithdrawalsService) {}

  @Post()
  @ApiOperation({ summary: 'Request a withdrawal (providers only)' })
  requestWithdrawal(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.withdrawalsService.requestWithdrawal(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my withdrawal history' })
  listMine(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.withdrawalsService.listMine(userId, Number(page), Number(limit));
  }

  @Get('banks')
  @ApiOperation({ summary: 'List Nigerian banks supported by Paystack' })
  listBanks() {
    return this.withdrawalsService.listBanks();
  }
}
