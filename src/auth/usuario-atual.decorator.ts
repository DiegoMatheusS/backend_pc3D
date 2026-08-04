import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Extrai o usuário autenticado da requisição.
 * Retorna null se não houver sessão ativa.
 */
export const UsuarioAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx
      .switchToHttp()
      .getRequest<
        Request & { usuario?: { id: number; papel: string } | null }
      >();
    return req.usuario ?? null;
  },
);
