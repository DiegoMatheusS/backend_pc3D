import type { NextFunction, Request, Response } from 'express';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CHAVES_PERIGOSAS = new Set(['__proto__', 'prototype', 'constructor']);

interface LimitesEstruturaJson {
  maxDepth: number;
  maxTotalKeys: number;
  maxArrayLength: number;
  maxStringLength: number;
}

const LIMITES_PADRAO: LimitesEstruturaJson = {
  maxDepth: 10,
  maxTotalKeys: 1_000,
  maxArrayLength: 200,
  maxStringLength: 100_000,
};

function origemNormalizada(valor: string): string | null {
  try {
    const url = new URL(valor);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizarOrigensPermitidas(origens: string[]): string[] {
  const resultado = new Set<string>();

  for (const origem of origens) {
    const normalizada = origemNormalizada(origem);
    if (!normalizada) {
      throw new Error(`Origem CORS inválida: ${origem}`);
    }
    resultado.add(normalizada);
  }

  return [...resultado];
}

/**
 * Defesa adicional contra CSRF em navegadores.
 *
 * - SameSite=Lax continua sendo a primeira barreira do cookie de sessão.
 * - Requisições unsafe com Origin precisam vir de uma origem autorizada.
 * - Sec-Fetch-Site=cross-site é bloqueado.
 * - Clientes não-browser sem Origin/Sec-Fetch-Site continuam permitidos.
 */
export function criarProtecaoOrigemNavegador(origensPermitidas: string[]) {
  const permitidas = new Set(normalizarOrigensPermitidas(origensPermitidas));

  return (req: Request, res: Response, next: NextFunction): void => {
    if (METODOS_SEGUROS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const secFetchSite = req.get('sec-fetch-site')?.toLowerCase();
    const origin = req.get('origin');

    if (origin) {
      const normalizada = origemNormalizada(origin);
      if (!normalizada || !permitidas.has(normalizada)) {
        res.status(403).json({
          statusCode: 403,
          codigo: 'ORIGEM_NAO_PERMITIDA',
          mensagem: 'A origem da requisição não é permitida.',
          detalhes: {},
        });
        return;
      }

      // Uma origem explicitamente autorizada pelo CORS pode ser cross-site
      // quando frontend e API usam domínios registráveis diferentes. O Origin
      // continua sendo a autoridade neste caso.
      next();
      return;
    }

    // Um navegador cross-site sem Origin verificável não deve conseguir usar
    // uma sessão por cookie em método de escrita.
    if (secFetchSite === 'cross-site') {
      res.status(403).json({
        statusCode: 403,
        codigo: 'ORIGEM_NAO_PERMITIDA',
        mensagem: 'A origem da requisição não é permitida.',
        detalhes: {},
      });
      return;
    }

    next();
  };
}

function validarEstruturaJson(
  valor: unknown,
  limites: LimitesEstruturaJson,
): { ok: true } | { ok: false; motivo: string } {
  if (valor === undefined) return { ok: true };

  let totalChaves = 0;
  const pilha: Array<{ valor: unknown; profundidade: number }> = [
    { valor, profundidade: 0 },
  ];

  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (!atual) break;

    if (atual.profundidade > limites.maxDepth) {
      return { ok: false, motivo: 'JSON profundo demais.' };
    }

    if (typeof atual.valor === 'string') {
      if (atual.valor.length > limites.maxStringLength) {
        return { ok: false, motivo: 'Texto individual grande demais.' };
      }
      if (atual.valor.includes('\u0000')) {
        return { ok: false, motivo: 'Texto contém caractere nulo inválido.' };
      }
      continue;
    }

    if (
      atual.valor === null ||
      typeof atual.valor === 'boolean' ||
      typeof atual.valor === 'number'
    ) {
      if (typeof atual.valor === 'number') {
        if (
          !Number.isFinite(atual.valor) ||
          Math.abs(atual.valor) > 1_000_000_000_000
        ) {
          return { ok: false, motivo: 'Número fora dos limites permitidos.' };
        }
      }
      continue;
    }

    if (Array.isArray(atual.valor)) {
      if (atual.valor.length > limites.maxArrayLength) {
        return { ok: false, motivo: 'Array grande demais.' };
      }
      for (const item of atual.valor) {
        pilha.push({ valor: item, profundidade: atual.profundidade + 1 });
      }
      continue;
    }

    if (typeof atual.valor !== 'object') {
      return { ok: false, motivo: 'Tipo de valor JSON inválido.' };
    }

    const objeto = atual.valor as Record<string, unknown>;
    const chaves = Object.keys(objeto);
    totalChaves += chaves.length;

    if (totalChaves > limites.maxTotalKeys) {
      return { ok: false, motivo: 'Objeto possui campos demais.' };
    }

    for (const chave of chaves) {
      if (CHAVES_PERIGOSAS.has(chave)) {
        return { ok: false, motivo: 'Chave de objeto não permitida.' };
      }
      pilha.push({
        valor: objeto[chave],
        profundidade: atual.profundidade + 1,
      });
    }
  }

  return { ok: true };
}

interface ErroParserCorpo {
  status?: number;
  type?: string;
}

function lerErroParserCorpo(erro: unknown): ErroParserCorpo | null {
  if (typeof erro !== 'object' || erro === null) return null;

  const candidato = erro as Record<string, unknown>;
  return {
    status: typeof candidato.status === 'number' ? candidato.status : undefined,
    type: typeof candidato.type === 'string' ? candidato.type : undefined,
  };
}

/**
 * Padroniza erros gerados pelos parsers Express antes de a requisição chegar
 * aos controllers do Nest (JSON inválido, corpo acima do limite etc.).
 */
export function tratarErrosParserCorpo() {
  return (
    erro: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const parser = lerErroParserCorpo(erro);

    if (
      parser?.status === 413 ||
      parser?.type === 'entity.too.large' ||
      parser?.type === 'parameters.too.many'
    ) {
      res.status(413).json({
        statusCode: 413,
        codigo: 'PAYLOAD_MUITO_GRANDE',
        mensagem: 'O corpo da requisição excede o limite permitido.',
        detalhes: {},
      });
      return;
    }

    if (parser?.status === 400 || parser?.type === 'entity.parse.failed') {
      res.status(400).json({
        statusCode: 400,
        codigo: 'REQUISICAO_INVALIDA',
        mensagem: 'O corpo da requisição é inválido.',
        detalhes: {},
      });
      return;
    }

    next(erro);
  };
}

/**
 * Limite estrutural global. Complementa os DTOs e protege inclusive campos
 * livres/legados que ainda aceitem objetos JSON.
 */
export function limitarComplexidadeJson(
  limitesParciais: Partial<LimitesEstruturaJson> = {},
) {
  const limites = { ...LIMITES_PADRAO, ...limitesParciais };

  return (req: Request, res: Response, next: NextFunction): void => {
    const resultado = validarEstruturaJson(req.body, limites);
    if ('motivo' in resultado) {
      res.status(413).json({
        statusCode: 413,
        codigo: 'PAYLOAD_MUITO_GRANDE',
        mensagem: resultado.motivo,
        detalhes: {},
      });
      return;
    }

    next();
  };
}

/**
 * Impede cache de respostas privadas/sensíveis em browser, proxy e CDN.
 * Também marca como privada qualquer resposta feita com cookie de sessão,
 * mesmo quando a rota consultada é pública para usuários anônimos.
 */
export function criarProtecaoCacheSensivel(nomeCookieSessao: string) {
  const caminhosSensiveis = [
    /^\/api\/auth(?:\/|$)/u,
    /^\/api\/usuarios(?:\/|$)/u,
    /^\/api\/admin(?:\/|$)/u,
    /^\/api\/auditoria(?:\/|$)/u,
    /^\/api\/busca-ofertas(?:\/|$)/u,
  ];

  return (req: Request, res: Response, next: NextFunction): void => {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const possuiSessao = typeof cookies?.[nomeCookieSessao] === 'string';
    const caminho = req.originalUrl.split('?')[0] ?? req.path;
    const caminhoSensivel = caminhosSensiveis.some((regex) =>
      regex.test(caminho),
    );

    if (possuiSessao || caminhoSensivel) {
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.vary('Cookie');
      res.vary('Origin');
    }

    next();
  };
}
