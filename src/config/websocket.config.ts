import { registerAs } from '@nestjs/config';

export default registerAs('websocket', () => ({
  cors: {
    origin: (process.env.WS_ALLOWED_ORIGINS || '*').split(','),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
  pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
  maxHttpBufferSize: parseInt(process.env.WS_MAX_BUFFER_SIZE || '1e6', 10),
}));
