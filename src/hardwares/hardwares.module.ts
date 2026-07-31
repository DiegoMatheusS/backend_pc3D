import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HardwaresAdminController } from './hardwares-admin.controller';
import { HardwaresController } from './hardwares.controller';
import { HardwaresService } from './hardwares.service';

@Module({
  imports: [AuthModule],
  controllers: [HardwaresController, HardwaresAdminController],
  providers: [HardwaresService],
})
export class HardwaresModule {}
