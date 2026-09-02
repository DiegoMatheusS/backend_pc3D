import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PapelGuard } from '../auth/papel.guard';
import { SugestoesOfertasModule } from '../sugestoes-ofertas/sugestoes-ofertas.module';
import { IaModule } from '../ia/ia.module';
import {
  OfertasController,
  OfertasAdminController,
} from './ofertas.controller';
import { OfertasService } from './ofertas.service';
import { VerificadorPrecosOfertasService } from './verificador-precos-ofertas.service';

@Module({
  imports: [AuthModule, AuditoriaModule, SugestoesOfertasModule, IaModule],
  controllers: [OfertasController, OfertasAdminController],
  providers: [OfertasService, VerificadorPrecosOfertasService, PapelGuard],
  exports: [OfertasService],
})
export class OfertasModule {}
