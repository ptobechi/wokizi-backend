import { registerAs } from '@nestjs/config';

export default registerAs('sms', () => ({
  termiiApiKey: process.env.TERMII_API_KEY || '',
  termiiSenderId: process.env.TERMII_SENDER_ID || 'Wokizi',
}));
