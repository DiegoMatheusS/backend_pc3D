import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CadastroDto } from './dtos/cadastro.dto';
import { GoogleAuthDto } from './dtos/google-auth.dto';
import { LoginDto } from './dtos/login.dto';
import {
  RecoverDto,
  PasswordDto,
  MfaDto,
  DisableMfaDto,
  ResetDto,
} from './dtos/account-security.dto';
import { AccountSecurityService } from './account-security.service';
import { AuthGuard } from './auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly accountSecurity: AccountSecurityService,
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
      sameSite: ambiente === 'production' ? 'strict' : 'lax',
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
  @Throttle({ global: { limit: 8, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dados: LoginDto,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    const resultado = await this.authService.login(dados);

    if ('requires2fa' in resultado) return resultado;

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
  @Throttle({ global: { limit: 5, ttl: 60_000 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async google(
    @Body() dados: GoogleAuthDto,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    const resultado = await this.authService.autenticarComGoogle(dados);

    if ('requires2fa' in resultado) return resultado;

    this.definirCookieSessao(resposta, resultado.token, resultado.expiraEm);

    return {
      usuario: resultado.usuario,
      expiraEm: resultado.expiraEm,
      novoUsuario: resultado.novoUsuario,
    };
  }

  @Post('login-2fa')
  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login2fa(
    @Body() body: MfaDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login2fa(body.desafio, body.codigo);
    this.definirCookieSessao(response, result.token, result.expiraEm);
    return { usuario: result.usuario, expiraEm: result.expiraEm };
  }
  @Post('recuperar-senha')
  @Throttle({ global: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  recover(@Body() body: RecoverDto) {
    return this.accountSecurity.recover(body.email);
  }
  @Post('redefinir-senha')
  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  reset(@Body() body: ResetDto) {
    return this.accountSecurity.reset(body.token, body.senha);
  }
  @Get('2fa')
  @UseGuards(AuthGuard)
  status2fa(@Req() req: Request & { usuario: { id: number } }) {
    return this.accountSecurity.status(req.usuario.id);
  }
  @Post('2fa/configurar')
  @UseGuards(AuthGuard)
  @Throttle({ global: { limit: 3, ttl: 60000 } })
  setup2fa(
    @Req() req: Request & { usuario: { id: number } },
    @Body() body: PasswordDto,
  ) {
    return this.accountSecurity.setup(req.usuario.id, body.senha);
  }
  @Post('2fa/ativar')
  @UseGuards(AuthGuard)
  @Throttle({ global: { limit: 5, ttl: 60000 } })
  activate2fa(
    @Req() req: Request & { usuario: { id: number } },
    @Body() body: MfaDto,
  ) {
    return this.accountSecurity.activate(
      req.usuario.id,
      body.desafio,
      body.codigo,
    );
  }
  @Post('2fa/desativar')
  @UseGuards(AuthGuard)
  @Throttle({ global: { limit: 5, ttl: 60000 } })
  disable2fa(
    @Req() req: Request & { usuario: { id: number } },
    @Body() body: DisableMfaDto,
  ) {
    return this.accountSecurity.disable(
      req.usuario.id,
      body.senha,
      body.codigo,
    );
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
      sameSite: ambiente === 'production' ? 'strict' : 'lax',
      path: '/',
    });
  }
}
