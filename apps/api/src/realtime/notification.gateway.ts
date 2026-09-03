import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../auth/auth.types';
import { NotificationRealtimeService } from './notification-realtime.service';
import {
  REALTIME_SOCKET_EVENT,
  userRoom,
} from './realtime.constants';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    tenantId: string;
  };
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly notificationRealtimeService: NotificationRealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.notificationRealtimeService.registerServer(server);
    this.logger.log('WebSocket gateway initialized at namespace /realtime');
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const user = this.authenticateClient(client);
      client.data = { userId: user.id, tenantId: user.tenantId };
      await client.join(userRoom(user.id));
      client.emit(REALTIME_SOCKET_EVENT.connected, {
        userId: user.id,
        tenantId: user.tenantId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'WebSocket authentication failed';
      this.logger.warn(`Rejecting socket ${client.id}: ${message}`);
      client.emit('error', { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    if (client.data?.userId) {
      this.logger.debug(`Socket disconnected for user ${client.data.userId}`);
    }
  }

  private authenticateClient(client: Socket): { id: string; tenantId: string } {
    const token = this.extractToken(client);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (!payload.sub || !payload.tenant_id) {
      throw new UnauthorizedException('Tenant access token required');
    }

    return { id: payload.sub, tenantId: payload.tenant_id };
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    return null;
  }
}
