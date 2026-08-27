import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';

// ─── Context ──────────────────────────────────────────────────────────────────
// Every field is optional — callers pass whatever they know.

export interface NotificationContext {
  /** Name of the artisan / service provider */
  artisanName?: string;
  /** Name of the client / customer */
  userName?: string;
  /** Generic sender name (chat messages etc.) */
  senderName?: string;
  /** Title of the service listing */
  serviceName?: string;
  /** Formatted currency amount  e.g. "₦12,000" */
  amount?: string;
  /** Human-readable rejection or cancellation reason */
  rejectionReason?: string;
  /** Dispute resolution text */
  resolution?: string;
  /** Numeric star rating (1–5) */
  rating?: number;
  /** Rating milestone string  e.g. "4.8" */
  ratingMilestone?: string;
  /** Booking status string — used by CONVERSATION_ARCHIVED template */
  bookingStatus?: string;
  /** Dispute outcome — "RESOLVED" or "REJECTED" */
  outcome?: string;
  /** Human-readable maintenance date */
  date?: string;
  /** Cancellation reason */
  cancelReason?: string;
  /** Subject line of a support ticket — used only by SUPPORT_TICKET_* templates */
  ticketSubject?: string;
}

export interface NotificationText {
  title: string;
  body: string;
}

type TemplateFactory = (ctx: NotificationContext) => NotificationText;

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Partial<Record<NotificationType, TemplateFactory>> = {

  // ── Messaging ───────────────────────────────────────────────────────────────

  NEW_MESSAGE: ({ senderName }) => ({
    title: 'New Message',
    body: `You received a new message from ${senderName ?? 'someone'}.`,
  }),

  // ── Service Requests ────────────────────────────────────────────────────────

  SERVICE_REQUEST_SENT: ({ artisanName }) => ({
    title: 'Request Sent',
    body: `Your request has been sent to ${artisanName ?? 'the artisan'}. You'll be notified once they respond.`,
  }),

  NEW_SERVICE_REQUEST: ({ userName, serviceName }) => ({
    title: 'New Service Request',
    body: `${userName ?? 'Someone'} has requested your ${serviceName ?? 'service'}. Review the details and respond.`,
  }),

  REQUEST_ACCEPTED: ({ artisanName }) => ({
    title: 'Request Accepted',
    body: `${artisanName ?? 'The artisan'} accepted your request. You can now discuss project details and pricing.`,
  }),

  REQUEST_REJECTED: ({ artisanName }) => ({
    title: 'Request Declined',
    body: `${artisanName ?? 'The artisan'} was unable to accept your request at this time. Explore other available artisans nearby.`,
  }),

  REQUEST_PRICE_ADJUSTED: ({ artisanName, amount }) => ({
    title: 'Price Updated',
    body: `${artisanName ?? 'The artisan'} accepted your request with an adjusted price${amount ? ` of ₦${amount}` : ''}. Review and confirm to continue.`,
  }),

  REQUEST_PRICE_ACCEPTED: ({ userName }) => ({
    title: 'Price Accepted',
    body: `${userName ?? 'The client'} accepted your price. You can now proceed to scheduling.`,
  }),

  REQUEST_PRICE_DECLINED: ({ userName, rejectionReason }) => ({
    title: 'Price Declined',
    body: `${userName ?? 'The client'} declined your adjusted price${rejectionReason ? `: ${rejectionReason}` : '.'}`,
  }),

  REQUEST_EXPIRED: () => ({
    title: 'Request Expired',
    body: 'Your service request went unanswered and has expired. Try requesting another nearby artisan.',
  }),

  // ── Quotations ──────────────────────────────────────────────────────────────

  NEW_QUOTE: ({ artisanName }) => ({
    title: 'Quotation Received',
    body: `${artisanName ?? 'Your artisan'} has submitted a quotation for your project. Review the pricing and respond.`,
  }),

  QUOTE_UPDATED: ({ artisanName }) => ({
    title: 'Quotation Updated',
    body: `${artisanName ?? 'Your artisan'} has sent a revised quotation. Review the updated pricing and terms.`,
  }),

  QUOTE_ACCEPTED: () => ({
    title: 'Quotation Accepted',
    body: 'The quotation has been accepted and your project is ready to begin.',
  }),

  QUOTE_REJECTED: ({ rejectionReason }) => ({
    title: 'Quotation Rejected',
    body: rejectionReason
      ? `The quotation was declined: ${rejectionReason}. You may submit a revised offer.`
      : 'The quotation was declined. You may submit a revised offer or close the negotiation.',
  }),

  // ── Bookings ────────────────────────────────────────────────────────────────

  BOOKING_CONFIRMED: ({ serviceName }) => ({
    title: 'Booking Confirmed',
    body: `${serviceName ?? 'A service'} has been booked and payment confirmed. Prepare for the job.`,
  }),

  BOOKING_ACCEPTED: ({ serviceName }) => ({
    title: 'Booking Accepted',
    body: `Your booking for ${serviceName ?? 'this service'} has been accepted.`,
  }),

  BOOKING_SCHEDULED: () => ({
    title: 'Booking Scheduled',
    body: 'Your booking has been scheduled. The artisan will arrive at the agreed time.',
  }),

  BOOKING_IN_PROGRESS: () => ({
    title: 'Work Started',
    body: 'The artisan has started work on your project.',
  }),

  BOOKING_PARTIALLY_COMPLETED: () => ({
    title: 'Work Partially Completed',
    body: 'A portion of the work has been completed. The artisan will continue as scheduled.',
  }),

  BOOKING_COMPLETED: () => ({
    title: 'Job Completed',
    body: 'Your project has been marked as completed. Please review the work and leave a rating.',
  }),

  BOOKING_CANCELLED: ({ cancelReason }) => ({
    title: 'Booking Cancelled',
    body: cancelReason
      ? `Your booking has been cancelled: ${cancelReason}`
      : 'Your booking has been cancelled.',
  }),

  BOOKING_DISPUTED: ({ userName }) => ({
    title: 'Dispute Raised',
    body: userName
      ? `${userName} has raised a dispute for this booking. Our team will investigate.`
      : 'A dispute has been raised for this booking. Our team will review and respond.',
  }),

  DISPUTE_RESOLVED: ({ outcome, resolution }) => ({
    title: outcome === 'RESOLVED' ? 'Dispute Resolved' : 'Dispute Closed',
    body: resolution
      ? resolution
      : outcome === 'RESOLVED'
        ? 'The dispute has been reviewed and resolved.'
        : 'The dispute investigation has been concluded.',
  }),

  CONVERSATION_ARCHIVED: ({ bookingStatus }) => ({
    title: bookingStatus === 'COMPLETED' ? 'Project Completed' : 'Conversation Closed',
    body: bookingStatus === 'COMPLETED'
      ? 'Your project has been completed. This conversation has been archived. To hire this artisan again, create a new service request.'
      : 'This booking has been cancelled. The conversation is now closed. Create a new request to book again.',
  }),

  // ── Tracking ────────────────────────────────────────────────────────────────

  ARTISAN_EN_ROUTE: ({ artisanName }) => ({
    title: 'Artisan On The Way',
    body: `${artisanName ?? 'Your artisan'} is heading to your location. Track their progress in real time.`,
  }),

  ARTISAN_ARRIVED: ({ artisanName }) => ({
    title: 'Artisan Arrived',
    body: `${artisanName ?? 'Your artisan'} has arrived at the job location.`,
  }),

  JOB_STARTED: () => ({
    title: 'Work Started',
    body: 'The artisan has started work on your project.',
  }),

  // ── Verification & Services ─────────────────────────────────────────────────

  VERIFICATION_SUBMITTED: () => ({
    title: 'Verification Submitted',
    body: "Your identity documents have been submitted and are under review. We'll notify you within 24–48 hours.",
  }),

  VERIFICATION_APPROVED: () => ({
    title: 'Identity Verified',
    body: 'Your identity has been verified. You can now submit your service listing for review.',
  }),

  VERIFICATION_REJECTED: ({ rejectionReason }) => ({
    title: 'Verification Update Required',
    body: rejectionReason
      ? `Additional information is required: ${rejectionReason}. Please resubmit your documents.`
      : 'Additional information is required before your account can be verified. Please resubmit your documents.',
  }),

  SERVICE_APPROVED: ({ serviceName }) => ({
    title: 'Service Approved',
    body: `Congratulations! "${serviceName ?? 'Your service'}" has been approved and is now live. Customers can now discover and book your service.`,
  }),

  SERVICE_SUBMITTED: ({ serviceName }) => ({
    title: 'Verification Submitted',
    body: `"${serviceName ?? 'Your service'}" has been submitted for review. We will notify you once verification is complete.`,
  }),

  SERVICE_REJECTED: ({ serviceName, rejectionReason }) => ({
    title: 'Verification Update Required',
    body: rejectionReason
      ? `Additional information is needed for "${serviceName ?? 'your service'}": ${rejectionReason}`
      : `Additional information is needed before "${serviceName ?? 'your service'}" can be approved. Please review and resubmit.`,
  }),

  SERVICE_SUSPENDED: ({ serviceName }) => ({
    title: 'Service Suspended',
    body: `"${serviceName ?? 'Your service'}" has been temporarily suspended. Contact support for details.`,
  }),

  // ── Social ──────────────────────────────────────────────────────────────────

  NEW_FOLLOWER: ({ userName }) => ({
    title: 'New Follower',
    body: `${userName ?? 'Someone'} started following you.`,
  }),

  // ── Reviews ─────────────────────────────────────────────────────────────────

  REVIEW_RECEIVED: ({ userName, rating }) => ({
    title: 'New Review Received',
    body: `${userName ?? 'A client'} left you a ${rating ? `${rating}-star` : 'new'} review. Check it out!`,
  }),

  RATING_MILESTONE: ({ ratingMilestone }) => ({
    title: 'Excellent Work',
    body: `You've reached a ${ratingMilestone ?? 'new'} star rating. Keep delivering great service!`,
  }),

  // ── Payments ────────────────────────────────────────────────────────────────

  WALLET_FUNDED: ({ amount }) => ({
    title: 'Funds Added Successfully',
    body: `Your wallet has been credited with ${amount ?? 'funds'}. You're ready to pay for services.`,
  }),

  PAYMENT_SUCCESSFUL: ({ serviceName }) => ({
    title: 'Payment Completed',
    body: `Payment for ${serviceName ?? 'your service'} has been successfully processed.`,
  }),

  PAYMENT_FAILED: () => ({
    title: 'Payment Failed',
    body: "We couldn't process your payment. Please try again or use another payment method.",
  }),

  WITHDRAWAL_REQUESTED: ({ amount }) => ({
    title: 'Withdrawal Request Submitted',
    body: amount
      ? `Your withdrawal request for ${amount} is under review. Processing takes 1–3 business days.`
      : 'Your withdrawal request is under review. Processing typically takes 1–3 business days.',
  }),

  WITHDRAWAL_APPROVED: ({ amount }) => ({
    title: 'Withdrawal Approved',
    body: amount
      ? `Your withdrawal of ${amount} has been approved and will be processed shortly.`
      : 'Your withdrawal request has been approved and will be processed shortly.',
  }),

  WITHDRAWAL_COMPLETED: ({ amount }) => ({
    title: 'Withdrawal Successful',
    body: amount
      ? `${amount} has been successfully transferred to your account.`
      : 'Your earnings have been successfully transferred to your account.',
  }),

  // ── System ──────────────────────────────────────────────────────────────────

  SYSTEM_MAINTENANCE: ({ date }) => ({
    title: 'Scheduled Maintenance',
    body: date
      ? `Wokizi will undergo scheduled maintenance on ${date}. Some features may be temporarily unavailable.`
      : 'Wokizi will undergo scheduled maintenance. Some features may be temporarily unavailable.',
  }),

  SECURITY_ALERT: () => ({
    title: 'Security Notice',
    body: 'We detected a new login to your account. If this was not you, please secure your account immediately.',
  }),

  // ── Support ─────────────────────────────────────────────────────────────────

  SUPPORT_TICKET_CREATED: ({ ticketSubject }) => ({
    title: 'Support Ticket Received',
    body: ticketSubject
      ? `We've received your request: "${ticketSubject}". Our team will get back to you within 24 hours.`
      : "We've received your support request. Our team will get back to you within 24 hours.",
  }),

  SUPPORT_TICKET_UPDATED: ({ ticketSubject }) => ({
    title: 'Ticket Update',
    body: ticketSubject
      ? `Your support ticket "${ticketSubject}" has been updated by our team.`
      : 'Your support ticket has been updated. Check the latest status in Help & Support.',
  }),

  SUPPORT_TICKET_RESOLVED: ({ ticketSubject }) => ({
    title: 'Ticket Resolved',
    body: ticketSubject
      ? `Your support ticket "${ticketSubject}" has been resolved. We hope this helped!`
      : 'Your support ticket has been resolved. We hope everything is sorted!',
  }),

  SUPPORT_TICKET_CLOSED: ({ ticketSubject }) => ({
    title: 'Ticket Closed',
    body: ticketSubject
      ? `Your support ticket "${ticketSubject}" has been closed.`
      : 'Your support ticket has been closed.',
  }),
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationTemplatesService {
  resolve(type: NotificationType, ctx: NotificationContext = {}): NotificationText {
    const factory = TEMPLATES[type];
    if (factory) return factory(ctx);
    return { title: 'Notification', body: 'You have a new notification.' };
  }
}
