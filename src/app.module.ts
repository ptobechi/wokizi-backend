import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Config
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';
import websocketConfig from './config/websocket.config';
import notificationConfig from './config/notification.config';
import smsConfig from './config/sms.config';

// Core & Integrations
import { CoreModule } from './core/core.module';
import { IntegrationsModule } from './integrations/integrations.module';

// Middleware
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { VerificationModule } from './modules/verification/verification.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ServicesModule } from './modules/services/services.module';
import { PortfoliosModule } from './modules/portfolios/portfolios.module';
import { FeedModule } from './modules/feed/feed.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { SearchModule } from './modules/search/search.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { FollowsModule } from './modules/follows/follows.module';
import { LikesModule } from './modules/likes/likes.module';
import { SavedServicesModule } from './modules/saved-services/saved-services.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SupportModule } from './modules/support/support.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // ─── Global Config ────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, storageConfig, websocketConfig, notificationConfig, smsConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // ─── Rate Limiting ────────────────────────────────────────
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),

    // ─── Infrastructure ───────────────────────────────────────
    CoreModule,
    IntegrationsModule,

    // ─── Feature Modules ──────────────────────────────────────
    AuthModule,
    UsersModule,
    ProfilesModule,
    VerificationModule,
    CategoriesModule,
    ServicesModule,
    PortfoliosModule,
    FeedModule,
    LocationsModule,
    ConversationsModule,
    MessagesModule,
    QuotationsModule,
    BookingsModule,
    ReviewsModule,
    DisputesModule,
    NotificationsModule,
    UploadsModule,
    SearchModule,
    AnalyticsModule,
    FollowsModule,
    LikesModule,
    SavedServicesModule,
    AdminModule,
    ReportsModule,
    SupportModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
