import { registerAs } from '@nestjs/config';

export default registerAs('notification', () => ({
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
  },
}));
