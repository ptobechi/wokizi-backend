import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = configService.get<string>('notification.resend.apiKey', '');
  }

  async sendEmail(to: string, subject: string, html: string, from?: string): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn('Resend API key not configured');
      return false;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from || 'Wokizi <noreply@wokizy.app>',
          to,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        this.logger.error(`Resend API error: ${response.status}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error(`Failed to send via Resend: ${(err as Error).message}`);
      return false;
    }
  }
}
