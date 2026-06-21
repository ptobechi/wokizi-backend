import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import type {
  IPaymentProvider,
  InitializePaymentResult,
  VerifyPaymentResult,
  RefundResult,
  CreateRecipientResult,
  InitiateTransferResult,
} from './payment-provider.interface';

@Injectable()
export class PaystackService implements IPaymentProvider {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl    = 'https://api.paystack.co';
  private readonly secretKey:  string;
  private readonly webhookSecret: string;
  private readonly isDev: boolean;

  constructor(private config: ConfigService) {
    this.secretKey     = config.get<string>('paystack.secretKey', '');
    this.webhookSecret = config.get<string>('paystack.webhookSecret', '');
    this.isDev         = config.get<string>('app.nodeEnv', 'development') !== 'production';
  }

  // ── Auth header ───────────────────────────────────────────────────────────────

  private headers() {
    return {
      Authorization:  `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  // ── Initialize Transaction ────────────────────────────────────────────────────

  async initializePayment(
    amount: number,
    email: string,
    reference: string,
    metadata?: Record<string, unknown>,
    channels?: string[],
  ): Promise<InitializePaymentResult> {
    if (this.isDev && !this.secretKey) {
      this.logger.warn('Paystack DEV mode — returning mock initialization');
      return {
        authorizationUrl: `https://checkout.paystack.com/dev-mock?reference=${reference}`,
        accessCode:       `dev-access-${Date.now()}`,
        reference,
      };
    }

    const res = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method:  'POST',
      headers: this.headers(),
      body: JSON.stringify({
        amount:    Math.round(amount * 100), // kobo
        email,
        reference,
        currency:  'NGN',
        channels:  channels ?? ['card', 'bank', 'ussd', 'bank_transfer'],
        metadata:  metadata ?? {},
      }),
    });

    const data = await res.json() as any;
    if (!data.status) {
      this.logger.error(`Paystack init failed: ${data.message}`);
      throw new Error(data.message ?? 'Failed to initialize payment');
    }

    return {
      authorizationUrl: data.data.authorization_url,
      accessCode:       data.data.access_code,
      reference:        data.data.reference,
    };
  }

  // ── Verify Transaction ────────────────────────────────────────────────────────

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    if (this.isDev && reference.startsWith('dev-')) {
      return {
        success:   true,
        reference,
        amount:    0,
        currency:  'NGN',
        channel:   'card',
        paidAt:    new Date().toISOString(),
      };
    }

    try {
      const res  = await fetch(`${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: this.headers(),
      });
      const data = await res.json() as any;

      if (!data.status || data.data.status !== 'success') {
        return {
          success:   false,
          reference,
          amount:    0,
          currency:  'NGN',
          channel:   '',
          paidAt:    null,
          error:     data.data?.gateway_response ?? data.message ?? 'Verification failed',
        };
      }

      return {
        success:       true,
        reference:     data.data.reference,
        amount:        data.data.amount / 100, // back to naira
        currency:      data.data.currency,
        channel:       data.data.channel,
        paidAt:        data.data.paid_at,
        customerEmail: data.data.customer?.email,
        metadata:      data.data.metadata ?? {},
      };
    } catch (err: any) {
      this.logger.error(`Paystack verify exception: ${err.message}`);
      return { success: false, reference, amount: 0, currency: 'NGN', channel: '', paidAt: null, error: err.message };
    }
  }

  // ── Refund ────────────────────────────────────────────────────────────────────

  async refund(transactionReference: string, amount?: number): Promise<RefundResult> {
    if (this.isDev && transactionReference.startsWith('dev-')) {
      return { success: true, refundId: `dev-refund-${Date.now()}` };
    }

    try {
      const body: any = { transaction: transactionReference };
      if (amount) body.amount = Math.round(amount * 100);

      const res  = await fetch(`${this.baseUrl}/refund`, {
        method:  'POST',
        headers: this.headers(),
        body:    JSON.stringify(body),
      });
      const data = await res.json() as any;

      if (!data.status) {
        return { success: false, error: data.message };
      }
      return { success: true, refundId: String(data.data.id) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ── Transfer Recipient ────────────────────────────────────────────────────────

  async createTransferRecipient(
    accountName: string,
    accountNumber: string,
    bankCode: string,
  ): Promise<CreateRecipientResult> {
    if (this.isDev && !this.secretKey) {
      return { success: true, recipientCode: `RCP_dev_${Date.now()}` };
    }

    try {
      const res  = await fetch(`${this.baseUrl}/transferrecipient`, {
        method:  'POST',
        headers: this.headers(),
        body: JSON.stringify({
          type:           'nuban',
          name:           accountName,
          account_number: accountNumber,
          bank_code:      bankCode,
          currency:       'NGN',
        }),
      });
      const data = await res.json() as any;

      if (!data.status) {
        return { success: false, error: data.message };
      }
      return { success: true, recipientCode: data.data.recipient_code };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ── Initiate Transfer ─────────────────────────────────────────────────────────

  async initiateTransfer(
    amount: number,
    recipientCode: string,
    reference: string,
    reason?: string,
  ): Promise<InitiateTransferResult> {
    if (this.isDev && recipientCode.startsWith('RCP_dev_')) {
      return { success: true, transferCode: `TRF_dev_${Date.now()}`, reference };
    }

    try {
      const res  = await fetch(`${this.baseUrl}/transfer`, {
        method:  'POST',
        headers: this.headers(),
        body: JSON.stringify({
          source:    'balance',
          amount:    Math.round(amount * 100), // kobo
          recipient: recipientCode,
          reference,
          reason:    reason ?? 'Wokizi Withdrawal',
        }),
      });
      const data = await res.json() as any;

      if (!data.status) {
        return { success: false, error: data.message };
      }
      return {
        success:      true,
        transferCode: data.data.transfer_code,
        reference:    data.data.reference,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ── Verify Transfer ───────────────────────────────────────────────────────────

  async verifyTransfer(transferCode: string): Promise<{ success: boolean; status: string; error?: string }> {
    if (this.isDev && transferCode.startsWith('TRF_dev_')) {
      return { success: true, status: 'success' };
    }

    try {
      const res  = await fetch(`${this.baseUrl}/transfer/${transferCode}`, {
        headers: this.headers(),
      });
      const data = await res.json() as any;

      if (!data.status) {
        return { success: false, status: 'failed', error: data.message };
      }
      return { success: data.data.status === 'success', status: data.data.status };
    } catch (err: any) {
      return { success: false, status: 'failed', error: err.message };
    }
  }

  // ── Webhook Signature Validation ──────────────────────────────────────────────

  validateWebhookSignature(payload: string, signature: string): boolean {
    if (this.isDev && !this.webhookSecret) {
      this.logger.warn('Paystack DEV mode — skipping webhook signature validation');
      return true;
    }
    const hash = createHmac('sha512', this.webhookSecret).update(payload).digest('hex');
    return hash === signature;
  }

  // ── Bank List (utility) ───────────────────────────────────────────────────────

  async listBanks(): Promise<{ name: string; code: string; slug: string }[]> {
    if (this.isDev && !this.secretKey) {
      return [
        { name: 'First Bank of Nigeria', code: '011', slug: 'first-bank-of-nigeria' },
        { name: 'Guaranty Trust Bank',   code: '058', slug: 'guaranty-trust-bank' },
        { name: 'Zenith Bank',           code: '057', slug: 'zenith-bank' },
        { name: 'United Bank for Africa', code: '033', slug: 'united-bank-for-africa' },
        { name: 'Access Bank',           code: '044', slug: 'access-bank' },
      ];
    }

    try {
      const res  = await fetch(`${this.baseUrl}/bank?country=nigeria&perPage=100`, { headers: this.headers() });
      const data = await res.json() as any;
      return (data.data ?? []).map((b: any) => ({ name: b.name, code: b.code, slug: b.slug }));
    } catch {
      return [];
    }
  }
}
