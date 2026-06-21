import {
  Body, Controller, Get, Headers, Param, Post,
  RawBodyRequest, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaymentsService } from '../services/payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // ── Wallet funding ─────────────────────────────────────────────────────────

  @Post('fund/initiate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initialize a Paystack transaction to fund wallet' })
  initiateFunding(
    @CurrentUser('id') userId: string,
    @Body('amount') amount: number,
  ) {
    return this.paymentsService.initiateFunding(userId, Number(amount));
  }

  @Get('fund/verify/:reference')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Verify a Paystack payment and credit wallet' })
  verifyFunding(
    @CurrentUser('id') userId: string,
    @Param('reference') reference: string,
  ) {
    return this.paymentsService.verifyFunding(userId, reference);
  }

  // ── Escrow ─────────────────────────────────────────────────────────────────

  @Post('escrow/:bookingId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create escrow hold from wallet balance for a booking' })
  createEscrow(
    @CurrentUser('id') customerId: string,
    @Param('bookingId') bookingId: string,
    @Body('quotationId') quotationId: string,
  ) {
    return this.paymentsService.createEscrow(customerId, bookingId, quotationId);
  }

  // ── Paystack Webhook (public — signature verified inside service) ───────────

  @Post('webhook/paystack')
  @ApiOperation({ summary: 'Paystack webhook receiver' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body);
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}
