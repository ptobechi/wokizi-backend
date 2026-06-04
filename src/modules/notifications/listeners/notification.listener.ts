import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../services/notifications.service';
import { EventName } from '../../../common/enums';

@Injectable()
export class NotificationListener {
  constructor(private notificationsService: NotificationsService) {}

  @OnEvent(EventName.NOTIFICATION_SEND)
  async handleNotificationSend(payload: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  }) {
    await this.notificationsService.send(payload as any);
  }
}
