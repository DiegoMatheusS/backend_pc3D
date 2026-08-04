/**
 * AdminGuard — mantido para retrocompatibilidade.
 * Internamente delega ao PapelGuard com papel ADMIN.
 * Prefira usar @Papeis(PapelUsuario.ADMIN) + PapelGuard em novas rotas.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PapelUsuario } from '../generated/prisma/enums';

type RequisicaoAutenticada = Request & {
  usuario?: { papel: PapelUsuario };
};

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { usuario } = context
      .switchToHttp()
      .getRequest<RequisicaoAutenticada>();

    if (usuario?.papel !== PapelUsuario.ADMIN) {
      throw new ForbiddenException(
        'Acesso permitido apenas para administradores.',
      );
    }

    return true;
  }
}
