import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
<<<<<<< HEAD
import { StorageModule } from '../storage/storage.module';
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
import { PapelGuard } from '../auth/papel.guard';
import { HardwaresAdminController } from './hardwares-admin.controller';
import { HardwaresController } from './hardwares.controller';
import { HardwaresService } from './hardwares.service';

@Module({
<<<<<<< HEAD
  imports: [AuthModule, AuditoriaModule, StorageModule],
=======
  imports: [AuthModule, AuditoriaModule],
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
  controllers: [HardwaresController, HardwaresAdminController],
  providers: [HardwaresService, PapelGuard],
  exports: [HardwaresService],
})
export class HardwaresModule {}
