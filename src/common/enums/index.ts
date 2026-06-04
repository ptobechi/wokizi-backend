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

  // Mail
  MAIL_SEND = 'mail.send',

  // Chat
  CHAT_MESSAGE = 'chat.message',
  CHAT_SYSTEM_MESSAGE = 'chat.system-message',

  // Notifications
  NOTIFICATION_SEND = 'notification.send',

  // Provider
  PROVIDER_METRICS_UPDATE = 'provider.metrics.update',

  // Bookings
  BOOKING_STATUS_CHANGED = 'booking.status_changed',

  // Verification
  VERIFICATION_SUBMITTED = 'verification.submitted',
  VERIFICATION_REVIEWED = 'verification.reviewed',
}
