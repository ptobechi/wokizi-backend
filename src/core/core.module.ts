import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { PrismaModule } from './prisma/prisma.module';
import { CacheServiceModule } from './cache/cache.module';
import { LoggerModule } from './logger/logger.module';
import { EventsModule } from './events/events.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SecurityModule } from './security/security.module';
import { QueueModule } from './queue/queue.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => ({
        store: await redisStore({
          host: cfg.get('redis.host'),
          port: cfg.get('redis.port'),
          password: cfg.get('redis.password') || undefined,
          db: cfg.get('redis.db') || 0,
        }),
        ttl: 300 * 1000,
      }),
    }),
    PrismaModule,
    DatabaseModule,
    CacheServiceModule,
    LoggerModule,
    EventsModule,
    WebsocketModule,
    SecurityModule,
    QueueModule,
  ],
  exports: [
    PrismaModule,
    DatabaseModule,
    CacheServiceModule,
    LoggerModule,
    EventsModule,
    WebsocketModule,
    SecurityModule,
    QueueModule,
  ],
})
export class CoreModule {}
