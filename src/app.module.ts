import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { HardwaresModule } from './hardwares/hardwares.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    PrismaModule,
    HealthModule,
    UsuariosModule,
    AuthModule,
    HardwaresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
