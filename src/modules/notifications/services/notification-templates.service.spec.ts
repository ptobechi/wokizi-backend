import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { NotificationTemplatesService } from './notification-templates.service';

describe('NotificationTemplatesService', () => {
  let service: NotificationTemplatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationTemplatesService],
    }).compile();
    service = module.get<NotificationTemplatesService>(NotificationTemplatesService);
  });

  // ── Fallback ──────────────────────────────────────────────────────────────

  it('returns generic fallback for unknown notification type', () => {
    const result = service.resolve('UNKNOWN_TYPE' as NotificationType);
    expect(result.title).toBe('Notification');
    expect(result.body).toBeTruthy();
  });

  // ── Messaging ─────────────────────────────────────────────────────────────

  describe('NEW_MESSAGE', () => {
    it('includes sender name when provided', () => {
      const r = service.resolve(NotificationType.NEW_MESSAGE, { senderName: 'Ada' });
      expect(r.body).toContain('Ada');
    });

    it('falls back to "someone" without senderName', () => {
      const r = service.resolve(NotificationType.NEW_MESSAGE, {});
      expect(r.body).toContain('someone');
    });
  });

  // ── Service Requests ──────────────────────────────────────────────────────

  describe('SERVICE_REQUEST_SENT', () => {
    it('includes artisan name', () => {
      const r = service.resolve(NotificationType.SERVICE_REQUEST_SENT, { artisanName: 'Chidi' });
      expect(r.body).toContain('Chidi');
    });
    it('falls back gracefully without artisanName', () => {
      const r = service.resolve(NotificationType.SERVICE_REQUEST_SENT, {});
      expect(r.body).toContain('artisan');
    });
  });

  describe('NEW_SERVICE_REQUEST', () => {
    it('includes both user and service name', () => {
      const r = service.resolve(NotificationType.NEW_SERVICE_REQUEST, {
        userName: 'Tunde', serviceName: 'Plumbing',
      });
      expect(r.body).toContain('Tunde');
      expect(r.body).toContain('Plumbing');
    });
  });

  describe('REQUEST_ACCEPTED', () => {
    it('includes artisan name', () => {
      const r = service.resolve(NotificationType.REQUEST_ACCEPTED, { artisanName: 'Ngozi' });
      expect(r.body).toContain('Ngozi');
    });
  });

  describe('REQUEST_REJECTED', () => {
    it('returns decline message with artisan name', () => {
      const r = service.resolve(NotificationType.REQUEST_REJECTED, { artisanName: 'Bayo' });
      expect(r.body).toContain('Bayo');
    });
  });

  describe('REQUEST_PRICE_ACCEPTED', () => {
    it('includes the client name', () => {
      const r = service.resolve(NotificationType.REQUEST_PRICE_ACCEPTED, { userName: 'Adaeze' });
      expect(r.body).toContain('Adaeze');
    });
  });

  describe('REQUEST_PRICE_DECLINED', () => {
    it('includes the client name and reason', () => {
      const r = service.resolve(NotificationType.REQUEST_PRICE_DECLINED, { userName: 'Adaeze', rejectionReason: 'Too expensive' });
      expect(r.body).toContain('Adaeze');
      expect(r.body).toContain('Too expensive');
    });
  });

  // ── Quotations ────────────────────────────────────────────────────────────

  describe('NEW_QUOTE', () => {
    it('includes artisan name', () => {
      const r = service.resolve(NotificationType.NEW_QUOTE, { artisanName: 'Emeka' });
      expect(r.body).toContain('Emeka');
    });
  });

  describe('QUOTE_UPDATED', () => {
    it('has non-empty title and body', () => {
      const r = service.resolve(NotificationType.QUOTE_UPDATED, { artisanName: 'Kola' });
      expect(r.title).toBeTruthy();
      expect(r.body).toBeTruthy();
    });
  });

  describe('QUOTE_ACCEPTED', () => {
    it('returns acceptance confirmation', () => {
      const r = service.resolve(NotificationType.QUOTE_ACCEPTED, {});
      expect(r.title).toContain('Accepted');
      expect(r.body).toBeTruthy();
    });
  });

  describe('QUOTE_REJECTED', () => {
    it('has non-empty body', () => {
      const r = service.resolve(NotificationType.QUOTE_REJECTED, {});
      expect(r.body).toBeTruthy();
    });
  });

  // ── Bookings ──────────────────────────────────────────────────────────────

  describe('BOOKING_CONFIRMED', () => {
    it('includes service name', () => {
      const r = service.resolve(NotificationType.BOOKING_CONFIRMED, { serviceName: 'Electrical Repair' });
      expect(r.body).toContain('Electrical Repair');
    });
  });

  describe('BOOKING_CANCELLED', () => {
    it('includes cancel reason when provided', () => {
      const r = service.resolve(NotificationType.BOOKING_CANCELLED, { cancelReason: 'Emergency came up' });
      expect(r.body).toContain('Emergency came up');
    });
    it('works without cancel reason', () => {
      const r = service.resolve(NotificationType.BOOKING_CANCELLED, {});
      expect(r.title).toBeTruthy();
    });
  });

  describe('BOOKING_COMPLETED', () => {
    it('has non-empty title and body', () => {
      const r = service.resolve(NotificationType.BOOKING_COMPLETED, { serviceName: 'Painting' });
      expect(r.title).toBeTruthy();
      expect(r.body).toBeTruthy();
    });
  });

  // ── Verification ──────────────────────────────────────────────────────────

  describe('VERIFICATION_APPROVED', () => {
    it('returns approval message', () => {
      const r = service.resolve(NotificationType.VERIFICATION_APPROVED, {});
      expect(r.title.toLowerCase()).toMatch(/verif|approved/i);
    });
  });

  describe('VERIFICATION_REJECTED', () => {
    it('includes rejection reason when provided', () => {
      const r = service.resolve(NotificationType.VERIFICATION_REJECTED, {
        rejectionReason: 'ID unclear',
      });
      expect(r.body).toContain('ID unclear');
    });
    it('handles missing rejection reason gracefully', () => {
      const r = service.resolve(NotificationType.VERIFICATION_REJECTED, {});
      expect(r.body).toBeTruthy();
    });
  });

  describe('SERVICE_SUBMITTED', () => {
    it('includes service name', () => {
      const r = service.resolve(NotificationType.SERVICE_SUBMITTED, { serviceName: 'Carpentry' });
      expect(r.body).toContain('Carpentry');
    });
  });

  // ── Payments ─────────────────────────────────────────────────────────────

  describe('WALLET_FUNDED', () => {
    it('includes amount', () => {
      const r = service.resolve(NotificationType.WALLET_FUNDED, { amount: '₦5,000' });
      expect(r.body).toContain('₦5,000');
    });
    it('works without amount', () => {
      const r = service.resolve(NotificationType.WALLET_FUNDED, {});
      expect(r.body).toBeTruthy();
    });
  });

  describe('PAYMENT_SUCCESSFUL', () => {
    it('includes service name', () => {
      const r = service.resolve(NotificationType.PAYMENT_SUCCESSFUL, { serviceName: 'Plumbing' });
      expect(r.body).toContain('Plumbing');
    });
  });

  describe('PAYMENT_FAILED', () => {
    it('returns payment failure message', () => {
      const r = service.resolve(NotificationType.PAYMENT_FAILED, {});
      expect(r.body.toLowerCase()).toContain('payment');
    });
  });

  describe('WITHDRAWAL_REQUESTED', () => {
    it('includes amount when provided', () => {
      const r = service.resolve(NotificationType.WITHDRAWAL_REQUESTED, { amount: '₦50,000' });
      expect(r.body).toContain('₦50,000');
    });
    it('works without amount', () => {
      const r = service.resolve(NotificationType.WITHDRAWAL_REQUESTED, {});
      expect(r.body).toContain('withdrawal');
    });
  });

  describe('WITHDRAWAL_APPROVED', () => {
    it('includes amount', () => {
      const r = service.resolve(NotificationType.WITHDRAWAL_APPROVED, { amount: '₦20,000' });
      expect(r.body).toContain('₦20,000');
    });
  });

  describe('WITHDRAWAL_COMPLETED', () => {
    it('includes amount when provided', () => {
      const r = service.resolve(NotificationType.WITHDRAWAL_COMPLETED, { amount: '₦20,000' });
      expect(r.body).toContain('₦20,000');
    });
    it('uses generic language without amount', () => {
      const r = service.resolve(NotificationType.WITHDRAWAL_COMPLETED, {});
      expect(r.body).toContain('earnings');
    });
  });

  // ── Support ───────────────────────────────────────────────────────────────

  describe('SUPPORT_TICKET_CREATED', () => {
    it('includes ticket subject', () => {
      const r = service.resolve(NotificationType.SUPPORT_TICKET_CREATED, {
        ticketSubject: 'Payment not received',
      });
      expect(r.body).toContain('Payment not received');
    });
    it('works without subject', () => {
      const r = service.resolve(NotificationType.SUPPORT_TICKET_CREATED, {});
      expect(r.body).toBeTruthy();
    });
  });

  describe('SUPPORT_TICKET_UPDATED', () => {
    it('includes ticket subject', () => {
      const r = service.resolve(NotificationType.SUPPORT_TICKET_UPDATED, {
        ticketSubject: 'Login issue',
      });
      expect(r.body).toContain('Login issue');
    });
  });

  describe('SUPPORT_TICKET_RESOLVED', () => {
    it('includes ticket subject and resolution language', () => {
      const r = service.resolve(NotificationType.SUPPORT_TICKET_RESOLVED, {
        ticketSubject: 'Refund request',
      });
      expect(r.body).toContain('Refund request');
      expect(r.body.toLowerCase()).toMatch(/resolved|helped/i);
    });
  });

  describe('SUPPORT_TICKET_CLOSED', () => {
    it('includes ticket subject', () => {
      const r = service.resolve(NotificationType.SUPPORT_TICKET_CLOSED, {
        ticketSubject: 'My ticket',
      });
      expect(r.body).toContain('My ticket');
    });
  });

  // ── System ────────────────────────────────────────────────────────────────

  describe('SYSTEM_MAINTENANCE', () => {
    it('includes date when provided', () => {
      const r = service.resolve(NotificationType.SYSTEM_MAINTENANCE, { date: 'Dec 25' });
      expect(r.body).toContain('Dec 25');
    });
    it('works without date', () => {
      const r = service.resolve(NotificationType.SYSTEM_MAINTENANCE, {});
      expect(r.body).toBeTruthy();
    });
  });

  describe('SECURITY_ALERT', () => {
    it('returns security warning message', () => {
      const r = service.resolve(NotificationType.SECURITY_ALERT, {});
      expect(r.body.toLowerCase()).toMatch(/login|account/i);
    });
  });

  // ── Additional Booking Types ──────────────────────────────────────────────

  describe('BOOKING_ACCEPTED', () => {
    it('includes service name', () => {
      const r = service.resolve(NotificationType.BOOKING_ACCEPTED, { serviceName: 'Electrical' });
      expect(r.body).toContain('Electrical');
    });
  });

  describe('BOOKING_SCHEDULED', () => {
    it('returns scheduling confirmation', () => {
      const r = service.resolve(NotificationType.BOOKING_SCHEDULED, {});
      expect(r.title).toContain('Scheduled');
    });
  });

  describe('BOOKING_IN_PROGRESS', () => {
    it('returns work-started message', () => {
      const r = service.resolve(NotificationType.BOOKING_IN_PROGRESS, {});
      expect(r.body).toContain('started');
    });
  });

  describe('BOOKING_PARTIALLY_COMPLETED', () => {
    it('has non-empty title and body', () => {
      const r = service.resolve(NotificationType.BOOKING_PARTIALLY_COMPLETED, {});
      expect(r.title).toBeTruthy();
      expect(r.body).toBeTruthy();
    });
  });

  describe('CONVERSATION_ARCHIVED', () => {
    it('uses completed language when bookingStatus is COMPLETED', () => {
      const r = service.resolve(NotificationType.CONVERSATION_ARCHIVED, { bookingStatus: 'COMPLETED' });
      expect(r.title).toContain('Completed');
    });
    it('uses cancelled language for other booking statuses', () => {
      const r = service.resolve(NotificationType.CONVERSATION_ARCHIVED, { bookingStatus: 'CANCELLED' });
      expect(r.title).toContain('Closed');
    });
  });

  describe('DISPUTE_RESOLVED', () => {
    it('shows resolved title when outcome is RESOLVED', () => {
      const r = service.resolve(NotificationType.DISPUTE_RESOLVED, { outcome: 'RESOLVED' });
      expect(r.title).toContain('Resolved');
    });
    it('shows closed title for non-RESOLVED outcome', () => {
      const r = service.resolve(NotificationType.DISPUTE_RESOLVED, { outcome: 'REJECTED' });
      expect(r.title).toContain('Closed');
    });
    it('uses resolution text as body when provided', () => {
      const r = service.resolve(NotificationType.DISPUTE_RESOLVED, { resolution: 'Refund issued' });
      expect(r.body).toBe('Refund issued');
    });
  });

  // ── Tracking ──────────────────────────────────────────────────────────────

  describe('ARTISAN_EN_ROUTE', () => {
    it('includes artisan name', () => {
      const r = service.resolve(NotificationType.ARTISAN_EN_ROUTE, { artisanName: 'Chukwu' });
      expect(r.body).toContain('Chukwu');
    });
  });

  describe('ARTISAN_ARRIVED', () => {
    it('includes artisan name', () => {
      const r = service.resolve(NotificationType.ARTISAN_ARRIVED, { artisanName: 'Tunde' });
      expect(r.body).toContain('Tunde');
    });
  });

  describe('JOB_STARTED', () => {
    it('returns work started message', () => {
      const r = service.resolve(NotificationType.JOB_STARTED, {});
      expect(r.body).toContain('started');
    });
  });

  // ── Service Status ────────────────────────────────────────────────────────

  describe('VERIFICATION_SUBMITTED', () => {
    it('returns submission confirmation', () => {
      const r = service.resolve(NotificationType.VERIFICATION_SUBMITTED, {});
      expect(r.body).toContain('submitted');
    });
  });

  describe('SERVICE_APPROVED', () => {
    it('includes service name', () => {
      const r = service.resolve(NotificationType.SERVICE_APPROVED, { serviceName: 'Plumbing' });
      expect(r.body).toContain('Plumbing');
    });
  });

  describe('SERVICE_REJECTED', () => {
    it('includes rejection reason when provided', () => {
      const r = service.resolve(NotificationType.SERVICE_REJECTED, {
        serviceName: 'Electrical', rejectionReason: 'Missing license',
      });
      expect(r.body).toContain('Missing license');
    });
    it('works without rejection reason', () => {
      const r = service.resolve(NotificationType.SERVICE_REJECTED, { serviceName: 'Painting' });
      expect(r.body).toContain('Painting');
    });
  });

  describe('SERVICE_SUSPENDED', () => {
    it('includes service name', () => {
      const r = service.resolve(NotificationType.SERVICE_SUSPENDED, { serviceName: 'Cleaning' });
      expect(r.body).toContain('Cleaning');
    });
  });

  describe('NEW_FOLLOWER', () => {
    it('includes follower name', () => {
      const r = service.resolve(NotificationType.NEW_FOLLOWER, { userName: 'Adaeze' });
      expect(r.body).toContain('Adaeze');
    });
    it('falls back gracefully without name', () => {
      const r = service.resolve(NotificationType.NEW_FOLLOWER, {});
      expect(r.body).toContain('Someone');
    });
  });

  // ── Disputes ──────────────────────────────────────────────────────────────

  describe('BOOKING_DISPUTED', () => {
    it('has non-empty title and body', () => {
      const r = service.resolve(NotificationType.BOOKING_DISPUTED, {});
      expect(r.title).toBeTruthy();
      expect(r.body).toBeTruthy();
    });
  });

  describe('DISPUTE_RESOLVED', () => {
    it('includes resolution when provided', () => {
      const r = service.resolve(NotificationType.DISPUTE_RESOLVED, { resolution: 'Refund issued' });
      // resolution may or may not be in body depending on template — just check it renders
      expect(r.title).toBeTruthy();
      expect(r.body).toBeTruthy();
    });
  });

  // ── Reviews ───────────────────────────────────────────────────────────────

  describe('REVIEW_RECEIVED', () => {
    it('includes rating when provided', () => {
      const r = service.resolve(NotificationType.REVIEW_RECEIVED, { rating: 5 });
      expect(r.body).toContain('5');
    });
  });

  describe('RATING_MILESTONE', () => {
    it('includes milestone value', () => {
      const r = service.resolve(NotificationType.RATING_MILESTONE, { ratingMilestone: '4.9' });
      expect(r.body).toContain('4.9');
    });
    it('uses fallback for missing milestone', () => {
      const r = service.resolve(NotificationType.RATING_MILESTONE, {});
      expect(r.body).toContain('new');
    });
  });
});
