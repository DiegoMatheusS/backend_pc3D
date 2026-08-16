import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Limita slugs públicos antes de qualquer consulta ao banco. */
@Injectable()
export class ParseSlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (
      typeof value !== 'string' ||
      value.length < 1 ||
      value.length > 220 ||
      !SLUG_REGEX.test(value)
    ) {
      throw new BadRequestException('Slug inválido.');
    }

    return value;
  }
}
