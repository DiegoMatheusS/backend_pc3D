import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PapelUsuario } from '../generated/prisma/enums';
import { PAPEIS_KEY } from './papeis.decorator';

type RequisicaoAutenticada = Request & {
  usuario?: { papel: PapelUsuario };
};

@Injectable()
export class PapelGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lê os papéis definidos pelo decorator @Papeis (handler ou class)
    const papeis = this.reflector.getAllAndOverride<PapelUsuario[]>(
      PAPEIS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Se a rota não declarou @Papeis, qualquer usuário autenticado passa
    if (!papeis || papeis.length === 0) {
      return true;
    }

    const { usuario } = context
      .switchToHttp()
      .getRequest<RequisicaoAutenticada>();

    if (!usuario) {
      throw new ForbiddenException('Acesso não autorizado.');
    }

    if (!papeis.includes(usuario.papel)) {
      throw new ForbiddenException(
        `Acesso permitido apenas para: ${papeis.join(', ')}.`,
      );
    }

    return true;
  }
}
