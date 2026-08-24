import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    const message = `Your Wokizi verification code is ${code}. Valid for 10 minutes. Do not share this code.`;

    // Falls back to console-logging unless Termii is both configured AND
    // explicitly enabled — independent of NODE_ENV (flipping NODE_ENV would
    // also disable Paystack's live mode and expose Swagger publicly, see
    // paystack.service.ts / main.ts). TERMII_ENABLED is deliberately
    // separate from TERMII_API_KEY so a real key can sit ready in .env
    // (e.g. while sender ID approval is pending) without sends actually
    // trying to use it yet.
    const apiKey = this.configService.get<string>('sms.termiiApiKey');
    const termiiEnabled = this.configService.get<boolean>('sms.termiiEnabled');
    if (!apiKey || !termiiEnabled) {
      return this.sendDevOtp(phone, code, message);
    }

    return this.sendViaTermii(phone, message);
  }

  private sendDevOtp(phone: string, code: string, message: string): SmsSendResult {
    // In development: log OTP to console so you can use it without real SMS
    console.log('\n' + '='.repeat(55));
    console.log('  🔑  WOKIZI DEV OTP');
    console.log('='.repeat(55));
    console.log(`  Phone : ${phone}`);
    console.log(`  Code  : ${code}`);
    console.log(`  Msg   : ${message}`);
    console.log('='.repeat(55) + '\n');
    return { success: true, messageId: `dev-${Date.now()}` };
  }

  private async sendViaTermii(phone: string, message: string): Promise<SmsSendResult> {
    const apiKey = this.configService.get<string>('sms.termiiApiKey');
    const senderId = this.configService.get<string>('sms.termiiSenderId', 'Wokizi');

    if (!apiKey) {
      this.logger.error('Termii API key not configured — cannot send SMS in production');
      return { success: false, error: 'SMS provider not configured' };
    }

    try {
      const response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          from: senderId,
          sms: message,
          type: 'plain',
          channel: 'dnd',
          api_key: apiKey,
        }),
      });

      const data = await response.json() as any;

      if (!response.ok || data.code !== 'ok') {
        this.logger.error(`Termii SMS failed: ${JSON.stringify(data)}`);
        return { success: false, error: data.message || 'SMS delivery failed' };
      }

      return { success: true, messageId: data.message_id };
    } catch (err) {
      this.logger.error(`Termii request error: ${(err as Error).message}`);
      return { success: false, error: 'SMS service unavailable' };
    }
  }
}
