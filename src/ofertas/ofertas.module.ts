import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PapelGuard } from '../auth/papel.guard';
import {
  OfertasController,
  OfertasAdminController,
} from './ofertas.controller';
import { OfertasService } from './ofertas.service';
<<<<<<< HEAD
import { VerificadorPrecosOfertasService } from './verificador-precos-ofertas.service';
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [OfertasController, OfertasAdminController],
<<<<<<< HEAD
  providers: [OfertasService, VerificadorPrecosOfertasService, PapelGuard],
=======
  providers: [OfertasService, PapelGuard],
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
  exports: [OfertasService],
})
export class OfertasModule {}
