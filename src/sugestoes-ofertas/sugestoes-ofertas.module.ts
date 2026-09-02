import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PapelGuard } from '../auth/papel.guard';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import {
  SugestoesOfertasAdminController,
  SugestoesOfertasController,
} from './sugestoes-ofertas.controller';
import { SugestoesOfertasService } from './sugestoes-ofertas.service';

@Module({
  imports: [AuthModule, AuditoriaModule, NotificacoesModule],
  controllers: [SugestoesOfertasController, SugestoesOfertasAdminController],
  providers: [SugestoesOfertasService, PapelGuard],
  exports: [SugestoesOfertasService],
})
export class SugestoesOfertasModule {}
