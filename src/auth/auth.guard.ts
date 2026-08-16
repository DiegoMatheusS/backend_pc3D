import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requisicao = context.switchToHttp().getRequest<Request>();

    const nomeCookie =
      this.configService.get<string>('SESSION_COOKIE_NAME') ??
      'pcbuilder_session';

    const cookies = requisicao.cookies as Record<string, unknown> | undefined;

    const token =
      typeof cookies?.[nomeCookie] === 'string'
        ? cookies[nomeCookie]
        : undefined;

    const usuario = await this.authService.validarSessao(token);

    Object.assign(requisicao, { usuario });

    return true;
  }
}
