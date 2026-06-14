import { Module } from '@nestjs/common';
import { NotificationsService } from './services/notifications.service';
import { NotificationTemplatesService } from './services/notification-templates.service';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationListener } from './listeners/notification.listener';
import { FirebaseModule } from '../../integrations/firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationTemplatesService, NotificationListener],
  exports: [NotificationsService, NotificationTemplatesService],
})
export class NotificationsModule {}
