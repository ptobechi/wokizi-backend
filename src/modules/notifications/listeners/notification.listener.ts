import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../services/notifications.service';
import { NotificationTemplatesService, NotificationContext } from '../services/notification-templates.service';
import { EventName } from '../../../common/enums';

// ─── Event shape emitted by all business services ─────────────────────────────
// Services emit `ctx` (template variables) + `linkData` (deep-link payload).
// Title and body are NEVER hardcoded in emitters — they are resolved here.

export interface NotificationEvent {
  userId: string;
  type: NotificationType;
  /** Template variables — artisanName, userName, amount, etc. */
  ctx?: NotificationContext;
  /** Stored in DB notification.data and forwarded via FCM for deep linking */
  linkData?: Record<string, string>;
}

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private notificationsService: NotificationsService,
    private templates: NotificationTemplatesService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(EventName.NOTIFICATION_SEND)
  async handleNotificationSend(event: NotificationEvent) {
    const { title, body } = this.templates.resolve(event.type, event.ctx ?? {});

    await this.notificationsService.send({
      userId: event.userId,
      type:   event.type,
      title,
      body,
      data:   event.linkData,
    });

    try {
      const { count } = await this.notificationsService.getUnreadCount(event.userId);
      // type/title/body/data ride along so a foregrounded client can act on
      // this specific event (e.g. show an incoming-request alert) instead of
      // only learning the badge count changed and having to guess why.
      this.eventEmitter.emit(EventName.NOTIFICATION_NEW, {
        userId: event.userId,
        count,
        type:   event.type,
        title,
        body,
        data:   event.linkData ?? {},
      });
    } catch (error) {
      this.logger.error(
        `Failed to broadcast unread count for user ${event.userId}`,
        error as Error,
      );
    }
  }
}
