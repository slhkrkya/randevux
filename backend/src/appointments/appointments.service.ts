import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
  ) {}

  // -- yardımcı: çakışma var mı?
  private async hasOverlap(params: {
    startsAt: Date;
    endsAt: Date;
    creatorId: string;
    inviteeId: string;
    excludeId?: string;
  }) {
    const { startsAt, endsAt, creatorId, inviteeId, excludeId } = params;

    return this.prisma.appointment.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        status: { not: 'CANCELLED' }, // iptal edilenler engel olmasın
        AND: [
          // zaman aralığı kesişimi: start < existing.end && end > existing.start
          { startsAt: { lt: endsAt } },
          { endsAt: { gt: startsAt } },
        ],
        // katılımcılardan herhangi birine ait randevu ile çakışma
        OR: [
          { creatorId: creatorId },
          { inviteeId: creatorId },
          { creatorId: inviteeId },
          { inviteeId: inviteeId },
        ],
      },
      select: { id: true },
    });
  }

  async create(currentUserId: string, dto: CreateAppointmentDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (!(startsAt < endsAt)) {
      throw new BadRequestException('startsAt endsAt\'ten küçük olmalı');
    }

    const invitee = await this.users.findByEmail(dto.inviteeEmail);
    if (!invitee) throw new BadRequestException('Davet edilen kullanıcı bulunamadı');

    // çakışma kontrolü (creator ve invitee tarafında)
    const overlap = await this.hasOverlap({
      startsAt, endsAt, creatorId: currentUserId, inviteeId: invitee.id,
    });
    if (overlap) throw new BadRequestException('OVERLAP');

    return this.prisma.appointment.create({
      data: {
        title: dto.title,
        startsAt,
        endsAt,
        notes: dto.notes,
        status: 'PENDING',
        creatorId: currentUserId,
        inviteeId: invitee.id,
      },
    });
  }

  // Kullanıcının dahil olduğu randevular
  async findMine(currentUserId: string) {
    return this.prisma.appointment.findMany({
      where: {
        OR: [
          { creatorId: currentUserId },
          { inviteeId: currentUserId },
        ],
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async update(currentUserId: string, id: string, dto: UpdateAppointmentDto) {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Randevu bulunamadı');

    if (existing.creatorId !== currentUserId) {
      throw new ForbiddenException('Sadece oluşturan güncelleyebilir');
    }

    const nextStartsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const nextEndsAt   = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    if (!(nextStartsAt < nextEndsAt)) {
      throw new BadRequestException('startsAt endsAt\'ten küçük olmalı');
    }

    // çakışma kontrolü (kendisi hariç)
    const overlap = await this.hasOverlap({
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      creatorId: existing.creatorId,
      inviteeId: existing.inviteeId,
      excludeId: id,
    });
    if (overlap) throw new BadRequestException('OVERLAP');

    return this.prisma.appointment.update({
      where: { id },
      data: {
        title: dto.title ?? existing.title,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        notes: dto.notes ?? existing.notes,
        status: dto.status ?? existing.status,
      },
    });
  }

  async cancel(currentUserId: string, id: string) {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Randevu bulunamadı');
    if (existing.creatorId !== currentUserId) {
      throw new ForbiddenException('Sadece oluşturan iptal edebilir');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async remove(currentUserId: string, id: string) {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) return { ok: true }; // idempotent davranış

    if (existing.creatorId !== currentUserId) {
      throw new ForbiddenException('Sadece oluşturan silebilir');
    }
    await this.prisma.appointment.delete({ where: { id } });
    return { ok: true };
  }
}