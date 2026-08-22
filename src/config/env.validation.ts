import { z } from 'zod';

const esquemaBase = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL é obrigatória.'),
    CORS_ORIGINS: z.string().trim().optional(),
    SESSION_DURATION_HOURS: z.coerce.number().min(1).max(168).default(8),
    SESSION_COOKIE_NAME: z.string().trim().min(1).max(120).optional(),
    TRUST_PROXY: z.enum(['true', 'false']).default('false'),
    SWAGGER_ENABLED: z.enum(['true', 'false']).default('false'),
    GOOGLE_CLIENT_ID: z
      .union([z.string().trim().min(20), z.literal('')])
      .optional(),
    GOOGLE_CLIENT_IDS: z.string().trim().optional(),
    R2_ENDPOINT: z.union([z.string().trim().url(), z.literal('')]).optional(),
    R2_BUCKET: z.union([z.string().trim().min(1), z.literal('')]).optional(),
    R2_ACCESS_KEY_ID: z
      .union([z.string().trim().min(1), z.literal('')])
      .optional(),
    R2_SECRET_ACCESS_KEY: z
      .union([z.string().trim().min(1), z.literal('')])
      .optional(),
    R2_PUBLIC_URL: z.union([z.string().trim().url(), z.literal('')]).optional(),
    GEMINI_API_KEY: z
      .union([z.string().trim().min(1), z.literal('')])
      .optional(),
  })
  .passthrough();

function listarErros(erro: z.ZodError): string {
  return erro.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');
}

function validarGrupoR2(config: Record<string, unknown>): void {
  const nomes = [
    'R2_ENDPOINT',
    'R2_BUCKET',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_PUBLIC_URL',
  ] as const;

  const preenchidos = nomes.filter((nome) => {
    const valor = config[nome];
    return typeof valor === 'string' && valor.trim().length > 0;
  });

  if (preenchidos.length > 0 && preenchidos.length !== nomes.length) {
    const faltando = nomes.filter((nome) => !preenchidos.includes(nome));
    throw new Error(
      `Configuração R2 incompleta. Faltam: ${faltando.join(', ')}.`,
    );
  }
}

export function validarVariaveisAmbiente(
  configOriginal: Record<string, unknown>,
): Record<string, unknown> {
  const resultado = esquemaBase.safeParse(configOriginal);

  if (!resultado.success) {
    throw new Error(
      `Variáveis de ambiente inválidas: ${listarErros(resultado.error)}`,
    );
  }

  const config: Record<string, unknown> = {
    ...configOriginal,
    ...resultado.data,
  };

  const producao = resultado.data.NODE_ENV === 'production';
  const nomeCookiePadrao = producao
    ? '__Host-criabyte_session'
    : 'pcbuilder_session';
  const nomeCookie = resultado.data.SESSION_COOKIE_NAME ?? nomeCookiePadrao;

  if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/u.test(nomeCookie)) {
    throw new Error('SESSION_COOKIE_NAME contém caracteres inválidos.');
  }

  if (producao) {
    if (!resultado.data.CORS_ORIGINS?.trim()) {
      throw new Error('CORS_ORIGINS é obrigatória em produção.');
    }

    if (!nomeCookie.startsWith('__Host-')) {
      throw new Error(
        'Em produção, SESSION_COOKIE_NAME deve usar o prefixo __Host-.',
      );
    }

    if (!resultado.data.GOOGLE_CLIENT_ID?.trim()) {
      throw new Error(
        'GOOGLE_CLIENT_ID é obrigatório em produção enquanto o login Google estiver habilitado.',
      );
    }
  }

  validarGrupoR2(config);

  config.SESSION_COOKIE_NAME = nomeCookie;
  config.SESSION_DURATION_HOURS = String(resultado.data.SESSION_DURATION_HOURS);
  config.PORT = String(resultado.data.PORT);

  return config;
}
