import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PapelGuard } from '../auth/papel.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import {
  NotebooksAdminController,
  NotebooksController,
} from './notebooks.controller';
import { NotebooksService } from './notebooks.service';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [NotebooksController, NotebooksAdminController],
  providers: [NotebooksService, PapelGuard],
  exports: [NotebooksService],
})
export class NotebooksModule {}
