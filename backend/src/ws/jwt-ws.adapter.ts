import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions, Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

function extractToken(socket: Socket): string | undefined {
  const auth = socket.handshake.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  const t = (socket.handshake.auth as any)?.token;
  if (typeof t === 'string') return t;
  const q = socket.handshake.query?.token;
  if (typeof q === 'string') return q;
  return undefined;
}

export class JwtWsAdapter extends IoAdapter {
  constructor(
    private app: INestApplicationContext,
    private config: ConfigService,
    private jwt: JwtService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: { origin: 'http://localhost:3000', credentials: true },
    });

    const authMiddleware = (socket: Socket, next: (err?: Error) => void) => {
      try {
        const token = extractToken(socket);
        if (!token) return next(new Error('Unauthorized'));
        const payload = this.jwt.verify(token, { secret: this.config.get<string>('JWT_SECRET')! });
        socket.data.user = { id: payload.sub, email: payload.email };
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    };

    // ÖNEMLİ: middleware’i hem root’a hem /ws namespace’ine uygula
    server.use(authMiddleware);
    server.of('/ws').use(authMiddleware);

    return server;
  }
}