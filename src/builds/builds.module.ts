import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PapelGuard } from '../auth/papel.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { HardwaresModule } from '../hardwares/hardwares.module';
import { BuildsAdminController, BuildsController } from './builds.controller';
import { BuildsService } from './builds.service';

@Module({
  imports: [AuthModule, AuditoriaModule, HardwaresModule],
  controllers: [BuildsController, BuildsAdminController],
  providers: [BuildsService, PapelGuard],
  exports: [BuildsService],
})
export class BuildsModule {}
