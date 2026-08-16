import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export interface SafeJsonObjectOptions {
  maxDepth?: number;
  maxKeys?: number;
  maxArrayLength?: number;
  maxStringLength?: number;
}

const CHAVES_PERIGOSAS = new Set(['__proto__', 'prototype', 'constructor']);

function objetoJsonSeguro(
  valor: unknown,
  opcoes: Required<SafeJsonObjectOptions>,
): boolean {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return false;
  }

  let totalChaves = 0;
  const pilha: Array<{ valor: unknown; profundidade: number }> = [
    { valor, profundidade: 1 },
  ];

  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (!atual) break;

    if (atual.profundidade > opcoes.maxDepth) return false;

    if (typeof atual.valor === 'string') {
      if (atual.valor.length > opcoes.maxStringLength) return false;
      continue;
    }

    if (
      atual.valor === null ||
      typeof atual.valor === 'boolean' ||
      typeof atual.valor === 'number'
    ) {
      if (typeof atual.valor === 'number' && !Number.isFinite(atual.valor)) {
        return false;
      }
      continue;
    }

    if (Array.isArray(atual.valor)) {
      if (atual.valor.length > opcoes.maxArrayLength) return false;
      for (const item of atual.valor) {
        pilha.push({ valor: item, profundidade: atual.profundidade + 1 });
      }
      continue;
    }

    if (typeof atual.valor !== 'object') return false;

    const objeto = atual.valor as Record<string, unknown>;
    const chaves = Object.keys(objeto);
    totalChaves += chaves.length;

    if (totalChaves > opcoes.maxKeys) return false;

    for (const chave of chaves) {
      if (CHAVES_PERIGOSAS.has(chave)) return false;
      pilha.push({
        valor: objeto[chave],
        profundidade: atual.profundidade + 1,
      });
    }
  }

  return true;
}

/**
 * Restringe objetos JSON livres (Record<string, unknown>) para evitar payloads
 * excessivamente profundos, arrays gigantes e chaves associadas a prototype
 * pollution. Não altera/sanitiza o conteúdo; apenas valida.
 */
export function IsSafeJsonObject(
  options: SafeJsonObjectOptions = {},
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  const opcoes: Required<SafeJsonObjectOptions> = {
    maxDepth: options.maxDepth ?? 6,
    maxKeys: options.maxKeys ?? 200,
    maxArrayLength: options.maxArrayLength ?? 64,
    maxStringLength: options.maxStringLength ?? 10_000,
  };

  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isSafeJsonObject',
      target: object.constructor,
      propertyName: String(propertyName),
      constraints: [opcoes],
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return objetoJsonSeguro(value, opcoes);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} excede os limites permitidos para um objeto JSON.`;
        },
      },
    });
  };
}
