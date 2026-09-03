export const WebSocketGateway = () => () => undefined;
export const WebSocketServer = () => () => undefined;
export const SubscribeMessage = () => () => undefined;
export const ConnectedSocket = () => () => undefined;
export const MessageBody = () => () => undefined;

export interface OnGatewayInit {
  afterInit(server: unknown): void;
}

export interface OnGatewayConnection {
  handleConnection(client: unknown): void;
}

export interface OnGatewayDisconnect {
  handleDisconnect(client: unknown): void;
}
