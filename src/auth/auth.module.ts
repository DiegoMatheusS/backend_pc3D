import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AdminGuard],
  exports: [AuthService, AuthGuard, AdminGuard],
})
export class AuthModule {}
