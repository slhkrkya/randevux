import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { JwtWsAdapter } from './ws/jwt-ws.adapter';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  // CORS: Next dev origin'ine izin ver
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  }));
  
  const config = app.get(ConfigService);
  const jwt = app.get(JwtService);
  app.useWebSocketAdapter(new JwtWsAdapter(app, config, jwt));

  const port = Number(process.env.PORT) || 4000;

  await app.listen(port);
}

bootstrap();