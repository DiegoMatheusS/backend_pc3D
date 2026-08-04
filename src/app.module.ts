import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { HardwaresModule } from './hardwares/hardwares.module';
import { MontagensModule } from './montagens/montagens.module';
import { OfertasModule } from './ofertas/ofertas.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { IaModule } from './ia/ia.module';
import { ProdutosModule } from './produtos/produtos.module';
import { NotebooksModule } from './notebooks/notebooks.module';
import { BuildsModule } from './builds/builds.module';
import { AvaliacoesModule } from './avaliacoes/avaliacoes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    // Rate limiting global: 120 requisições por minuto por IP.
    // Rotas sensíveis/caras sobrescrevem esse limite com @Throttle.
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    HealthModule,
    UsuariosModule,
    AuthModule,
    HardwaresModule,
    MontagensModule,
    OfertasModule,
    AuditoriaModule,
    IaModule,
    ProdutosModule,
    NotebooksModule,
    BuildsModule,
    AvaliacoesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Aplica o rate limiting globalmente em todas as rotas
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
