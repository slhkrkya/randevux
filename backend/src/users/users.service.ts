import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }
  
  async createUser(params: { email: string; password: string; name: string }) {
    const email = params.email.toLowerCase();
    const passwordHash = await bcrypt.hash(params.password, 10);

    try {
      return await this.prisma.user.create({
        data: { email, passwordHash, name: params.name },
        select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
      });
    } catch (e: any) {
      // P2002 = unique violation
      if (e?.code === 'P2002') {
        throw new Error('EMAIL_TAKEN');
      }
      throw e;
    }
  }
   async getMe(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new BadRequestException('Kullanıcı bulunamadı');
    return this.safeUser(u);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
      },
    });
    return this.safeUser(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Mevcut şifre hatalı');

    const same = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (same) throw new BadRequestException('Yeni şifre eski şifre ile aynı olamaz');

    const hash = await bcrypt.hash(dto.newPassword, 12);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
    return this.safeUser(updated);
  }

  async changeEmail(userId: string, dto: ChangeEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Mevcut şifre hatalı');

    // citext sayesinde DB case-insensitive benzersizlik sağlıyor;
    // yine de normalize etmek istersen:
    const email = dto.newEmail.trim();

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { email },
      });
      return this.safeUser(updated);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Bu e-posta zaten kullanımda');
      }
      throw e;
    }
  }

  private safeUser(u: any) {
    const { passwordHash, ...rest } = u;
    return rest;
  }
}