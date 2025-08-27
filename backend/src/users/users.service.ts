import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

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
}