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
import { ComunidadeModule } from './comunidade/comunidade.module';
import { BuscaOfertasModule } from './busca-ofertas/busca-ofertas.module';
import { SugestoesOfertasModule } from './sugestoes-ofertas/sugestoes-ofertas.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { ChatbotAdminModule } from './chatbot-admin/chatbot-admin.module';
import { HardwaresDescobertaIaModule } from './hardwares-descoberta-ia/hardwares-descoberta-ia.module';
import { ProdutoIaIntegracaoInternaModule } from './produto-ia-integracao-interna/produto-ia-integracao-interna.module';
import { validarVariaveisAmbiente } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validarVariaveisAmbiente,
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
    // Registre as rotas específicas de sugestões antes de /admin/ofertas/:id
    // para evitar que "sugestoes" seja interpretado como id de Oferta.
    SugestoesOfertasModule,
    NotificacoesModule,
    OfertasModule,
    AuditoriaModule,
    IaModule,
    ChatbotAdminModule,
    HardwaresDescobertaIaModule,
    ProdutoIaIntegracaoInternaModule,
    ProdutosModule,
    NotebooksModule,
    BuildsModule,
    AvaliacoesModule,
    ComunidadeModule,
    BuscaOfertasModule,
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
