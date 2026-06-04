import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: configService.get('notification.smtp.host'),
      port: configService.get('notification.smtp.port'),
      auth: {
        user: configService.get('notification.smtp.user'),
        pass: configService.get('notification.smtp.pass'),
      },
    });
  }

  @OnEvent('mail.send')
  async handleSendMail(payload: {
    to: string;
    subject: string;
    code?: string;
    type?: string;
    body?: string;
  }) {
    await this.send(payload.to, payload.subject, this.buildEmailBody(payload));
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const from = this.configService.get<string>('notification.smtp.from');
    try {
      await this.transporter.sendMail({ from, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }

  private buildEmailBody(payload: { code?: string; type?: string; body?: string }): string {
    if (payload.body) return payload.body;
    if (payload.code) {
      return `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Wokizi Verification</h2>
          <p>Your verification code is:</p>
          <h1 style="letter-spacing:8px;font-size:40px;color:#6366f1">${payload.code}</h1>
          <p>This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `;
    }
    return '';
  }
}
