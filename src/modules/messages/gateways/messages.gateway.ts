import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
  OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from '../services/messages.service';
import { SendMessageDto } from '../dto/requests/send-message.dto';
import { EventName } from '../../../common/enums';
import { TrackingEvent } from '../../locations/services/tracking.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class MessagesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(MessagesGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private messagesService: MessagesService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Chat WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) { client.disconnect(); return; }

    try {
      const payload = this.jwtService.verify(token, { secret: this.configService.get('jwt.accessSecret') });
      (client as any).userId = payload.sub;
      client.join(`user:${payload.sub}`);

      const sockets = this.userSockets.get(payload.sub) || new Set();
      sockets.add(client.id);
      this.userSockets.set(payload.sub, sockets);

      this.server.emit('user:online', { userId: payload.sub });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId;
    if (!userId) return;
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        this.server.emit('user:offline', { userId });
      }
    }
  }

  @SubscribeMessage('join:conversation')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: { conversationId: string }) {
    client.join(`conversation:${payload.conversationId}`);
    return { event: 'joined', conversationId: payload.conversationId };
  }

  @SubscribeMessage('leave:conversation')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() payload: { conversationId: string }) {
    client.leave(`conversation:${payload.conversationId}`);
  }

  @SubscribeMessage('message:send')
  async handleSend(@ConnectedSocket() client: Socket, @MessageBody() payload: { conversationId: string; message: SendMessageDto }) {
    const userId = (client as any).userId;
    if (!userId) return;
    const message = await this.messagesService.send(userId, payload.conversationId, payload.message);
    this.server.to(`conversation:${payload.conversationId}`).emit('message:new', message);
    return { event: 'message:sent', message };
  }

  @SubscribeMessage('message:delivered')
  async handleDelivered(@ConnectedSocket() client: Socket, @MessageBody() payload: { messageId: string }) {
    const msg = await this.messagesService.markDelivered(payload.messageId);
    this.server.to(`conversation:${msg.conversationId}`).emit('message:delivered', { messageId: payload.messageId });
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(@ConnectedSocket() client: Socket, @MessageBody() payload: { conversationId: string }) {
    const userId = (client as any).userId;
    client.to(`conversation:${payload.conversationId}`).emit('typing:start', { userId });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(@ConnectedSocket() client: Socket, @MessageBody() payload: { conversationId: string }) {
    const userId = (client as any).userId;
    client.to(`conversation:${payload.conversationId}`).emit('typing:stop', { userId });
  }

  @SubscribeMessage('user:status')
  handleUserStatus(@MessageBody() payload: { userId: string }) {
    return { userId: payload.userId, isOnline: this.userSockets.has(payload.userId) };
  }

  @OnEvent(EventName.CHAT_MESSAGE)
  handleChatEvent(payload: { message: any; conversationId: string }) {
    this.server.to(`conversation:${payload.conversationId}`).emit('message:new', payload.message);
  }

  @OnEvent(EventName.NOTIFICATION_NEW)
  handleNotificationNew(payload: {
    userId: string; count: number; type?: string; title?: string; body?: string; data?: Record<string, string>;
  }) {
    this.sendToUser(payload.userId, 'notification:new', {
      count: payload.count,
      type:  payload.type,
      title: payload.title,
      body:  payload.body,
      data:  payload.data,
    });
  }

  // ── Tracking events — emitted to the customer watching their artisan ────────

  @OnEvent(TrackingEvent.TRACKING_STARTED)
  handleTrackingStarted(payload: { bookingId: string; artisanId: string; customerId: string }) {
    this.sendToUser(payload.customerId, 'tracking:started', payload);
  }

  @OnEvent(TrackingEvent.LOCATION_UPDATED)
  handleLocationUpdated(payload: { bookingId: string; artisanId: string; customerId: string; lat: number; lng: number }) {
    this.sendToUser(payload.customerId, 'tracking:location', payload);
  }

  @OnEvent(TrackingEvent.ARTISAN_ARRIVED)
  handleArtisanArrived(payload: { bookingId: string; artisanId: string; customerId: string }) {
    this.sendToUser(payload.customerId, 'tracking:arrived', payload);
  }

  @OnEvent(TrackingEvent.TRACKING_STOPPED)
  handleTrackingStopped(payload: { bookingId: string; artisanId: string; customerId: string }) {
    this.sendToUser(payload.customerId, 'tracking:stopped', payload);
  }

  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  isOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }
}
