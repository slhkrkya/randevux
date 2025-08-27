import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage } from '@nestjs/websockets';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';

@WebSocketGateway({ namespace: '/ws' })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private prisma: PrismaService) {}

  afterInit() {
    // console.log('WS initialized');
  }

  handleConnection(client: Socket) {
    const user = client.data?.user; // JwtWsAdapter handshake'te set ediyor
    // Geçici log: bağlanan kullanıcıyı görmek istersen aç
    // console.log('[ws] connect', client.id, user);
    if (user?.id) {
      client.join(`user:${user.id}`); // kişisel oda
    } else {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // console.log('WS disconnect', client.id);
  }
   // --- Yardımcı: bu kullanıcı bu randevuya erişebilir mi? ---
  private async canJoinAppointment(userId: string, appointmentId: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { creatorId: true, inviteeId: true },
    });
    if (!appt) return false;
    return appt.creatorId === userId || appt.inviteeId === userId;
  }

  // ===== WebRTC signaling =====

  // İstemci: socket.emit('webrtc.join', { appointmentId })
  @SubscribeMessage('webrtc.join')
  async onJoin(client: Socket, payload: { appointmentId: string }) {
    const user = client.data?.user;
    const appointmentId = payload?.appointmentId;
    if (!user?.id || !appointmentId) {
      client.emit('webrtc.error', { message: 'Unauthorized or bad payload' });
      return;
    }

    const ok = await this.canJoinAppointment(user.id, appointmentId);
    if (!ok) {
      client.emit('webrtc.error', { message: 'Not allowed for this appointment' });
      return;
    }

    const room = `appt:${appointmentId}`;
    await client.join(room);

    // Odadaki diğer katılımcıya haber ver (offer başlatması için tetik)
    client.to(room).emit('webrtc.peer-joined', { from: client.id, appointmentId });
  }

  // İstemci: socket.emit('webrtc.leave', { appointmentId })
  @SubscribeMessage('webrtc.leave')
  async onLeave(client: Socket, payload: { appointmentId: string }) {
    const room = `appt:${payload?.appointmentId}`;
    await client.leave(room);
    client.to(room).emit('webrtc.peer-left', { from: client.id });
  }

  // İstemci: socket.emit('webrtc.offer', { appointmentId, to, sdp })
  @SubscribeMessage('webrtc.offer')
  onOffer(
    client: Socket,
    payload: { appointmentId: string; to: string; sdp: any },
  ) {
    const room = `appt:${payload?.appointmentId}`;
    if (!client.rooms.has(room)) return; // odaya katılmamışsa relay yok
    client.to(payload.to).emit('webrtc.offer', {
      from: client.id,
      sdp: payload.sdp,
      appointmentId: payload.appointmentId,
    });
  }

  // İstemci: socket.emit('webrtc.answer', { appointmentId, to, sdp })
  @SubscribeMessage('webrtc.answer')
  onAnswer(
    client: Socket,
    payload: { appointmentId: string; to: string; sdp: any },
  ) {
    const room = `appt:${payload?.appointmentId}`;
    if (!client.rooms.has(room)) return;
    client.to(payload.to).emit('webrtc.answer', {
      from: client.id,
      sdp: payload.sdp,
      appointmentId: payload.appointmentId,
    });
  }

  // İstemci: socket.emit('webrtc.ice', { appointmentId, to, candidate })
  @SubscribeMessage('webrtc.ice')
  onIce(
    client: Socket,
    payload: { appointmentId: string; to: string; candidate: any },
  ) {
    const room = `appt:${payload?.appointmentId}`;
    if (!client.rooms.has(room)) return;
    client.to(payload.to).emit('webrtc.ice', {
      from: client.id,
      candidate: payload.candidate,
      appointmentId: payload.appointmentId,
    });
  }
}