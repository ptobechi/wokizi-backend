import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: any;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const projectId = this.configService.get<string>('notification.firebase.projectId');
    const privateKey = this.configService.get<string>('notification.firebase.privateKey');
    const clientEmail = this.configService.get<string>('notification.firebase.clientEmail');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn('Firebase credentials not configured — push notifications disabled');
      return;
    }

    try {
      const admin = await import('firebase-admin');
      if (!admin.apps.length) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({ projectId, privateKey, clientEmail }),
        });
      } else {
        this.app = admin.apps[0];
      }
      this.logger.log('Firebase Admin initialized');
    } catch (err) {
      this.logger.error('Failed to initialize Firebase', (err as Error).message);
    }
  }

  async sendToToken(token: string, payload: PushPayload): Promise<boolean> {
    if (!this.app) return false;
    try {
      const { messaging } = await import('firebase-admin');
      await messaging(this.app).send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
      return true;
    } catch (err) {
      this.logger.warn(`Failed to send push to token: ${(err as Error).message}`);
      return false;
    }
  }

  async sendToTokens(tokens: string[], payload: PushPayload): Promise<{ successCount: number; failureCount: number }> {
    if (!this.app || !tokens.length) return { successCount: 0, failureCount: tokens.length };
    try {
      const { messaging } = await import('firebase-admin');
      const response = await messaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
      return { successCount: response.successCount, failureCount: response.failureCount };
    } catch (err) {
      this.logger.error(`Multicast push failed: ${(err as Error).message}`);
      return { successCount: 0, failureCount: tokens.length };
    }
  }
}
