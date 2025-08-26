import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async register(params: { email: string; password: string; name: string }) {
    try {
      const user = await this.users.createUser(params);
      const token = await this.signToken(user.id, user.email);
      return { user, token };
    } catch (e: any) {
      if (e?.message === 'EMAIL_TAKEN') {
        throw new BadRequestException('Email zaten kayıtlı');
      }
      throw e;
    }
  }

  async login(params: { email: string; password: string }) {
    const found = await this.users.findByEmail(params.email);
    if (!found) throw new UnauthorizedException('Geçersiz kimlik bilgileri');

    const ok = await bcrypt.compare(params.password, found.passwordHash);
    if (!ok) throw new UnauthorizedException('Geçersiz kimlik bilgileri');

    // response user objesinden hash'i çıkart
    const user = { id: found.id, email: found.email, name: found.name, createdAt: found.createdAt, updatedAt: found.updatedAt };
    const token = await this.signToken(found.id, found.email);
    return { user, token };
  }

  private async signToken(sub: string, email: string) {
    return this.jwt.signAsync({ sub, email });
  }
}