import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PapelGuard } from '../auth/papel.guard';
import { HardwaresAdminController } from './hardwares-admin.controller';
import { HardwaresController } from './hardwares.controller';
import { HardwaresService } from './hardwares.service';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [HardwaresController, HardwaresAdminController],
  providers: [HardwaresService, PapelGuard],
  exports: [HardwaresService],
})
export class HardwaresModule {}
