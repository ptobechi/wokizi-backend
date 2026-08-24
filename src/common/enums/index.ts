export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

export enum EventName {
  // Auth
  USER_REGISTERED = 'user.registered',
  USER_LOGGED_IN = 'user.logged_in',

  // Chat
  CHAT_MESSAGE = 'chat.message',
  CHAT_SYSTEM_MESSAGE = 'chat.system-message',

  // Notifications
  NOTIFICATION_SEND = 'notification.send',
  NOTIFICATION_NEW  = 'notification.new',

  // Provider
  PROVIDER_METRICS_UPDATE = 'provider.metrics.update',

  // Bookings
  BOOKING_STATUS_CHANGED = 'booking.status_changed',

  // Verification
  VERIFICATION_SUBMITTED = 'verification.submitted',
  VERIFICATION_REVIEWED = 'verification.reviewed',

  // Payments & Wallet
  PAYMENT_INITIATED     = 'payment.initiated',
  PAYMENT_COMPLETED     = 'payment.completed',
  PAYMENT_FAILED        = 'payment.failed',
  ESCROW_HELD           = 'escrow.held',
  ESCROW_RELEASED       = 'escrow.released',
  ESCROW_REFUNDED       = 'escrow.refunded',
  WALLET_FUNDED         = 'wallet.funded',
  WITHDRAWAL_REQUESTED  = 'withdrawal.requested',
  WITHDRAWAL_PROCESSED  = 'withdrawal.processed',
  TRANSFER_FAILED       = 'transfer.failed',
  TRANSFER_COMPLETED    = 'transfer.completed',
}
