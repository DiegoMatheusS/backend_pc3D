import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface IdentidadeGoogleVerificada {
  sub: string;
  email: string;
  nome: string;
  emailAutoritativo: boolean;
}

@Injectable()
export class GoogleIdentityService {
  private readonly cliente = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  private obterClientIds(): string[] {
    const principal = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const multiplos = this.configService.get<string>('GOOGLE_CLIENT_IDS');

    return [
      ...(principal ? [principal] : []),
      ...(multiplos ? multiplos.split(',') : []),
    ]
      .map((valor) => valor.trim())
      .filter(Boolean)
      .filter((valor, indice, lista) => lista.indexOf(valor) === indice);
  }

  async verificarCredential(
    credential: string,
  ): Promise<IdentidadeGoogleVerificada> {
    const clientIds = this.obterClientIds();

    if (clientIds.length === 0) {
      throw new ServiceUnavailableException(
        'Login com Google não está configurado no servidor.',
      );
    }

    try {
      const ticket = await this.cliente.verifyIdToken({
        idToken: credential,
        audience: clientIds.length === 1 ? clientIds[0] : clientIds,
      });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new UnauthorizedException(
          'A conta Google não possui um e-mail verificado.',
        );
      }

      const email = payload.email.trim().toLowerCase();
      const nomeGoogle = payload.name?.trim();
      const nomeFallback = email.split('@')[0]?.trim() || 'Usuário Google';

      return {
        sub: payload.sub,
        email,
        nome: (nomeGoogle || nomeFallback).slice(0, 150),
        // Para Gmail e Google Workspace, o Google é autoridade sobre o e-mail.
        // Isso permite vincular com segurança uma conta local do mesmo e-mail.
        emailAutoritativo:
          email.endsWith('@gmail.com') || Boolean(payload.hd?.trim()),
      };
    } catch (erro: unknown) {
      if (erro instanceof UnauthorizedException) {
        throw erro;
      }

      throw new UnauthorizedException(
        'Credencial do Google inválida ou expirada.',
      );
    }
  }
}
