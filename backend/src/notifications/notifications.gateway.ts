import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/ws' })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  afterInit() {
    // console.log('WS initialized');
  }

  handleConnection(client: Socket) {
    const user = client.data?.user;
    // Geçici teşhis:
    console.log('[ws] connect', client.id, user);
    if (user?.id) {
      client.join(`user:${user.id}`);
      // console.log('joined room', `user:${user.id}`);
    } else {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // console.log('WS disconnect', client.id);
  }
}