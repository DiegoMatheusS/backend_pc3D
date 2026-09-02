import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import { PapelGuard } from '../auth/papel.guard';
import { HardwaresModule } from '../hardwares/hardwares.module';
import { IaModule } from '../ia/ia.module';
import { ChatbotAdminController } from './chatbot-admin.controller';
import { ChatbotAdminService } from './chatbot-admin.service';

@Module({
  imports: [AuthModule, AuditoriaModule, HardwaresModule, IaModule],
  controllers: [ChatbotAdminController],
  providers: [ChatbotAdminService, PapelGuard],
})
export class ChatbotAdminModule {}
