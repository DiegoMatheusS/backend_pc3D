import { SetMetadata } from '@nestjs/common';
import { PapelUsuario } from '../generated/prisma/enums';

export const PAPEIS_KEY = 'papeis';

/**
 * Define quais papéis têm acesso à rota.
 * Deve ser usado junto com AuthGuard + PapelGuard.
 *
 * @example
 * @Papeis(PapelUsuario.EDITOR, PapelUsuario.ADMIN)
 * @UseGuards(AuthGuard, PapelGuard)
 */
export const Papeis = (...papeis: PapelUsuario[]) =>
  SetMetadata(PAPEIS_KEY, papeis);
