import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

type RequisicaoAutenticada = Request & {
  usuario?: {
    papel: string;
  };
};

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requisicao = context
      .switchToHttp()
      .getRequest<RequisicaoAutenticada>();

    if (requisicao.usuario?.papel !== 'ADMIN') {
      throw new ForbiddenException(
        'Acesso permitido apenas para administradores.',
      );
    }

    return true;
  }
}
