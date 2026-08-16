import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HardwaresModule } from '../hardwares/hardwares.module';
import { OfertasModule } from '../ofertas/ofertas.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthGuardOpcional } from '../auth/auth-guard-opcional.guard';
import { MontagensController } from './montagens.controller';
import { MontagensService } from './montagens.service';

@Module({
  imports: [AuthModule, HardwaresModule, OfertasModule, AuditoriaModule],
  controllers: [MontagensController],
  providers: [MontagensService, AuthGuardOpcional],
})
export class MontagensModule {}
