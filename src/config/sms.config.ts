import { registerAs } from '@nestjs/config';

export default registerAs('sms', () => ({
  termiiApiKey: process.env.TERMII_API_KEY || '',
  termiiSenderId: process.env.TERMII_SENDER_ID || 'Wokizi',
  // Explicit toggle, separate from whether an API key is configured — lets a
  // real key sit in .env ready to go (e.g. while Termii sender ID approval
  // is pending) without OTP sends actually trying to use it yet.
  termiiEnabled: process.env.TERMII_ENABLED === 'true',
}));
