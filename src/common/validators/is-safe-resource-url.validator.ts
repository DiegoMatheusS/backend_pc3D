import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

function isHttpOrHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function hasAsciiControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) {
      return true;
    }
  }
  return false;
}

function isSafeRootRelativePath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.includes('\\') || hasAsciiControlCharacter(value)) return false;

  const pathOnly = value.split(/[?#]/u, 1)[0] ?? '';
  let decodedPath = pathOnly;

  try {
    // Duas passagens também bloqueiam traversal duplamente codificado.
    for (let i = 0; i < 2; i += 1) {
      const next = decodeURIComponent(decodedPath);
      if (next === decodedPath) break;
      decodedPath = next;
    }
  } catch {
    return false;
  }

  if (decodedPath.includes('\\') || hasAsciiControlCharacter(decodedPath)) {
    return false;
  }

  const segments = decodedPath.split('/');
  return !segments.some((segment) => segment === '..');
}

/**
 * Aceita apenas recursos http(s) absolutos ou caminhos internos iniciados em
 * uma única barra, como /modelos/cpu.glb. Bloqueia javascript:, data:, file:,
 * URLs com credenciais, caminhos protocol-relative e traversal "..".
 */
export function IsSafeResourceUrl(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isSafeResourceUrl',
      target: object.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          return isHttpOrHttpsUrl(value) || isSafeRootRelativePath(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} deve ser uma URL http(s) válida ou um caminho interno seguro iniciado por /.`;
        },
      },
    });
  };
}
