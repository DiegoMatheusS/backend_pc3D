import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const INT32_MAX = 2_147_483_647;

/**
 * Converte parâmetros numéricos de rota para inteiro positivo dentro do
 * intervalo aceito pelos IDs `Int` do PostgreSQL/Prisma deste projeto.
 *
 * O ValidationPipe global pode entregar parâmetros primitivos já convertidos
 * para `number`. Por isso este pipe aceita tanto a string original da rota
 * quanto um número previamente transformado.
 */
@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<
  string | number,
  number
> {
  transform(value: string | number): number {
    let parsed: number;

    if (typeof value === 'number') {
      parsed = value;
    } else if (/^[1-9]\d*$/u.test(value)) {
      parsed = Number(value);
    } else {
      throw new BadRequestException('Identificador numérico inválido.');
    }

    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > INT32_MAX) {
      throw new BadRequestException('Identificador numérico fora do limite.');
    }

    return parsed;
  }
}
