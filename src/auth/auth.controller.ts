import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private obterNomeCookie(): string {
    return (
      this.configService.get<string>('SESSION_COOKIE_NAME') ??
      'pcbuilder_session'
    );
  }

  private obterTokenCookie(requisicao: Request): string | undefined {
    const cookies = requisicao.cookies as unknown;

    if (typeof cookies !== 'object' || cookies === null) {
      return undefined;
    }

    const token = (cookies as Record<string, unknown>)[this.obterNomeCookie()];

    return typeof token === 'string' ? token : undefined;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dados: LoginDto,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    const resultado = await this.authService.login(dados);

    const ambiente =
      this.configService.get<string>('NODE_ENV') ?? 'development';

    resposta.cookie(this.obterNomeCookie(), resultado.token, {
      httpOnly: true,
      secure: ambiente === 'production',
      sameSite: 'lax',
      expires: resultado.expiraEm,
      path: '/',
    });

    return {
      usuario: resultado.usuario,
      expiraEm: resultado.expiraEm,
    };
  }

  @Get('perfil')
  perfil(@Req() requisicao: Request) {
    const token = this.obterTokenCookie(requisicao);

    return this.authService.perfil(token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() requisicao: Request,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<void> {
    const token = this.obterTokenCookie(requisicao);

    await this.authService.logout(token);

    resposta.clearCookie(this.obterNomeCookie(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }
}
