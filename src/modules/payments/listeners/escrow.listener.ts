import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentsService } from '../services/payments.service';
import { EventName } from '../../../common/enums';

// bookings.service.ts emits these on booking completion/cancellation but never
// called releaseEscrow()/refundEscrow() itself — this listener is the missing
// connection between that event and the already-implemented payout/refund logic.
@Injectable()
export class EscrowListener {
  private readonly logger = new Logger(EscrowListener.name);

  constructor(private paymentsService: PaymentsService) {}

  @OnEvent(EventName.ESCROW_RELEASED)
  async handleEscrowReleased(payload: { bookingId: string }) {
    try {
      await this.paymentsService.releaseEscrow(payload.bookingId);
    } catch (error) {
      this.logger.error(`Failed to release escrow for booking ${payload.bookingId}`, error as Error);
    }
  }

  @OnEvent(EventName.ESCROW_REFUNDED)
  async handleEscrowRefunded(payload: { bookingId: string }) {
    try {
      await this.paymentsService.refundEscrow(payload.bookingId);
    } catch (error) {
      this.logger.error(`Failed to refund escrow for booking ${payload.bookingId}`, error as Error);
    }
  }
}
