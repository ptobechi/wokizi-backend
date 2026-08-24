import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ExpoService } from '../../../integrations/expo/expo.service';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';

interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

interface RegisterDeviceInput {
  token: string;
  deviceId: string;
  deviceType?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private expo: ExpoService,
  ) {}

  // Called by the mobile app once a push permission is granted (and again on
  // every authenticated app start, since Expo tokens can rotate). Upserts by
  // (userId, deviceId) — the same key auth.service.ts's OTP-verify device
  // upsert uses — so a device registered here or at login converges to one row.
  async registerDevice(userId: string, dto: RegisterDeviceInput) {
    await this.prisma.userDevice.upsert({
      where: { userId_deviceId: { userId, deviceId: dto.deviceId } },
      update: { fcmToken: dto.token, isActive: true, lastSeenAt: new Date() },
      create: {
        userId,
        deviceId: dto.deviceId,
        deviceType: dto.deviceType ?? 'mobile',
        fcmToken: dto.token,
      },
    });
    return { message: 'Device registered' };
  }

  async send(payload: NotificationPayload) {
    const prefs = await this.prisma.notificationPreference.findUnique({ where: { userId: payload.userId } });

    await this.prisma.notification.create({
      data: { userId: payload.userId, type: payload.type, title: payload.title, body: payload.body, data: payload.data },
    });

    if (!prefs || prefs.pushEnabled) {
      await this.sendPush(payload);
    }
  }

  async getMine(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.update({ where: { id, userId }, data: { isRead: true, readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    return { message: 'All marked as read' };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }

  async updatePreferences(userId: string, prefs: any) {
    return this.prisma.notificationPreference.upsert({ where: { userId }, update: prefs, create: { userId, ...prefs } });
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.findUnique({ where: { userId } });
  }

  private async sendPush(payload: NotificationPayload) {
    const devices = await this.prisma.userDevice.findMany({
      where: { userId: payload.userId, isActive: true },
      select: { fcmToken: true },
    });
    const tokens = devices.map(d => d.fcmToken).filter(Boolean) as string[];
    if (tokens.length) {
      await this.expo.sendToTokens(tokens, { title: payload.title, body: payload.body });
    }
  }
}
