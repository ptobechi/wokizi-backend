import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './logger/logger.module';
import { EventsModule } from './events/events.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SecurityModule } from './security/security.module';
import { QueueModule } from './queue/queue.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    PrismaModule,
    DatabaseModule,
    LoggerModule,
    EventsModule,
    WebsocketModule,
    SecurityModule,
    QueueModule,
  ],
  exports: [
    PrismaModule,
    DatabaseModule,
    LoggerModule,
    EventsModule,
    WebsocketModule,
    SecurityModule,
    QueueModule,
  ],
})
export class CoreModule {}
