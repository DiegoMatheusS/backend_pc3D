import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PapelGuard } from '../auth/papel.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import {
  AvaliacoesController,
  BuildsAvaliacoesController,
  HardwaresAvaliacoesController,
  NotebooksAvaliacoesController,
  ProdutosAvaliacoesController,
} from './avaliacoes.controller';
import { AvaliacoesService } from './avaliacoes.service';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [
    ProdutosAvaliacoesController,
    AvaliacoesController,
    HardwaresAvaliacoesController,
    NotebooksAvaliacoesController,
    BuildsAvaliacoesController,
  ],
  providers: [AvaliacoesService, PapelGuard],
  exports: [AvaliacoesService],
})
export class AvaliacoesModule {}
