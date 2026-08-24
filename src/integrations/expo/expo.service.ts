import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// Sends push notifications through Expo's push service, which the mobile app
// (wokizi) is built around — it requests Expo push tokens via
// Notifications.getExpoPushTokenAsync(), not raw FCM/APNs device tokens, so
// delivery must go through Expo rather than calling Firebase/APNs directly.
@Injectable()
export class ExpoService {
  private readonly logger = new Logger(ExpoService.name);
  private readonly expo = new Expo();

  async sendToTokens(tokens: string[], payload: PushPayload): Promise<{ successCount: number; failureCount: number }> {
    const validTokens = tokens.filter((token) => {
      if (Expo.isExpoPushToken(token)) return true;
      this.logger.warn(`Skipping invalid Expo push token: ${token}`);
      return false;
    });

    if (!validTokens.length) return { successCount: 0, failureCount: tokens.length };

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    let successCount = 0;
    let failureCount = 0;

    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          if (ticket.status === 'ok') successCount++;
          else {
            failureCount++;
            this.logger.warn(`Push ticket error: ${ticket.message ?? 'unknown error'}`);
          }
        }
      } catch (err) {
        failureCount += chunk.length;
        this.logger.error(`Failed to send push chunk: ${(err as Error).message}`);
      }
    }

    return { successCount, failureCount: failureCount + (tokens.length - validTokens.length) };
  }
}
