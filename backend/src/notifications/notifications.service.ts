import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(private gw: NotificationsGateway) {}

  appointmentCreated(appt: any) {
    this.toUsers([appt.creatorId, appt.inviteeId], 'appointment.created', appt);
  }
  appointmentUpdated(appt: any) {
    this.toUsers([appt.creatorId, appt.inviteeId], 'appointment.updated', appt);
  }
  appointmentCancelled(appt: any) {
    this.toUsers([appt.creatorId, appt.inviteeId], 'appointment.cancelled', appt);
  }
  appointmentDeleted(creatorId: string, inviteeId: string, payload: any) {
    this.toUsers([creatorId, inviteeId], 'appointment.deleted', payload);
  }

  private toUsers(userIds: string[], event: string, data: any) {
    const unique = Array.from(new Set(userIds.filter(Boolean)));
    unique.forEach(uid => this.gw.server.to(`user:${uid}`).emit(event, data));
  }
}