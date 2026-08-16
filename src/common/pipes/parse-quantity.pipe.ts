import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Quantidade curta usada em parâmetros simples de query. */
@Injectable()
export class ParseQuantityPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (typeof value !== 'string' || !/^[1-9]\d*$/u.test(value)) {
      throw new BadRequestException('Quantidade inválida.');
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 64) {
      throw new BadRequestException('Quantidade deve estar entre 1 e 64.');
    }

    return parsed;
  }
}
