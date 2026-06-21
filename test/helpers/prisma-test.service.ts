import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaTestService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    super({ datasources: { db: { url: testUrl } } });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Truncate all tables in reverse dependency order between test runs. */
  async cleanDatabase() {
    const tableNames = [
      'audit_logs',
      'payment_audits',
      'escrow_reservations',
      'wallet_transactions',
      'payments',
      'withdrawals',
      'wallets',
      'tracking_sessions',
      'support_ticket_messages',
      'support_tickets',
      'notifications',
      'reviews',
      'booking_disputes',
      'bookings',
      'messages',
      'quotation_line_items',
      'quotations',
      'conversation_participants',
      'conversations',
      'provider_holidays',
      'availability_slots',
      'availabilities',
      'service_listing_categories',
      'service_listings',
      'verifications',
      'addresses',
      'user_profiles',
      'otp_codes',
      'user_devices',
      'users',
      'categories',
    ];

    await this.$transaction(
      tableNames.map((table) => this.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`)),
    );
  }
}
