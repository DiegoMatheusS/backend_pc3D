import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HardwaresModule } from '../hardwares/hardwares.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PapelGuard } from '../auth/papel.guard';
import { IaController } from './ia.controller';
import { IaAdminController } from './ia-admin.controller';
import { IaService } from './ia.service';
import { IaProvider } from './ia.provider';

@Module({
  imports: [AuthModule, HardwaresModule, AuditoriaModule],
  controllers: [IaController, IaAdminController],
  providers: [IaService, IaProvider, PapelGuard],
})
export class IaModule {}
