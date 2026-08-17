import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';
import { AuthGuardOpcional } from './auth-guard-opcional.guard';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { GoogleIdentityService } from './google-identity.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleIdentityService,
    AuthGuard,
    AuthGuardOpcional,
    AdminGuard,
  ],
  exports: [AuthService, AuthGuard, AuthGuardOpcional, AdminGuard],
})
export class AuthModule {}
