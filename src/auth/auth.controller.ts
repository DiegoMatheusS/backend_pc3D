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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CadastroDto } from './dtos/cadastro.dto';
import { GoogleAuthDto } from './dtos/google-auth.dto';
import { LoginDto } from './dtos/login.dto';

@ApiTags('Auth')
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

  private definirCookieSessao(
    resposta: Response,
    token: string,
    expiraEm: Date,
  ): void {
    const ambiente =
      this.configService.get<string>('NODE_ENV') ?? 'development';

    resposta.cookie(this.obterNomeCookie(), token, {
      httpOnly: true,
      secure: ambiente === 'production',
      sameSite: 'lax',
      expires: expiraEm,
      path: '/',
    });
  }

  @ApiOperation({
    summary: 'Cadastrar nova conta de usuário',
    description:
      'Toda nova conta pública é criada obrigatoriamente com o papel USUARIO.',
  })
  @Throttle({ global: { limit: 5, ttl: 60_000 } })
  @Post('cadastro')
  cadastrar(@Body() dados: CadastroDto) {
    return this.authService.cadastrar(dados);
  }

  @ApiOperation({ summary: 'Autenticar usuário e criar sessão (cookie)' })
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dados: LoginDto,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    const resultado = await this.authService.login(dados);

    this.definirCookieSessao(resposta, resultado.token, resultado.expiraEm);

    return {
      usuario: resultado.usuario,
      expiraEm: resultado.expiraEm,
    };
  }

  @ApiOperation({
    summary: 'Cadastrar ou entrar com Google e criar sessão',
    description:
      'Valida a credential do Google no servidor. Se o e-mail já existir, vincula a conta; caso contrário, cria um novo USUARIO.',
  })
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async google(
    @Body() dados: GoogleAuthDto,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    const resultado = await this.authService.autenticarComGoogle(dados);

    this.definirCookieSessao(resposta, resultado.token, resultado.expiraEm);

    return {
      usuario: resultado.usuario,
      expiraEm: resultado.expiraEm,
      novoUsuario: resultado.novoUsuario,
    };
  }

  @ApiOperation({
    summary: 'Retorna dados do usuário autenticado pela sessão ativa',
  })
  @Get('perfil')
  perfil(@Req() requisicao: Request) {
    const token = this.obterTokenCookie(requisicao);

    return this.authService.perfil(token);
  }

  @ApiOperation({ summary: 'Encerrar sessão do usuário' })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() requisicao: Request,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<void> {
    const token = this.obterTokenCookie(requisicao);

    await this.authService.logout(token);

    const ambiente =
      this.configService.get<string>('NODE_ENV') ?? 'development';

    resposta.clearCookie(this.obterNomeCookie(), {
      httpOnly: true,
      secure: ambiente === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
}
