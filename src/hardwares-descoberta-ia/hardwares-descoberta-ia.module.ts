import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import { PapelGuard } from '../auth/papel.guard';
import { HardwaresModule } from '../hardwares/hardwares.module';
import { IaModule } from '../ia/ia.module';
import { HardwaresDescobertaIaController } from './hardwares-descoberta-ia.controller';
import { HardwaresDescobertaIaService } from './hardwares-descoberta-ia.service';

@Module({
  imports: [AuthModule, AuditoriaModule, HardwaresModule, IaModule],
  controllers: [HardwaresDescobertaIaController],
  providers: [HardwaresDescobertaIaService, PapelGuard],
})
export class HardwaresDescobertaIaModule {}
