import { BadRequestException } from '@nestjs/common';

type IdentidadeTexto = {
  marca?: unknown;
  modelo?: unknown;
  categoria?: unknown;
};

const narrativa =
  /\b(?:conhe[cç]a|descubra|aproveite|compre\s+(?:agora|j[aá])|experimente|eleve\s+(?:seu|sua)|revoluciona|transforme|(?:foi|foram)\s+(?:criad[oa]s?|desenvolvid[oa]s?|projetad[oa]s?|lan[cç]ad[oa]s?)|[eé]\s+(?:ideal|perfeit[oa]|a\s+escolha)|oferece\s+(?:uma?|o|a)|proporciona|nossa\s+hist[oó]ria|hist[oó]ria\s+(?:da|do|de|deste|desta)|desde\s+(?:19|20)\d{2})\b/i;
const comercial =
  /\b(?:frete\s+gr[aá]tis|oferta\s+imperd[ií]vel|promo[cç][aã]o|melhor\s+pre[cç]o|compre\s+agora|em\s+at[eé]\s+\d+\s*x|envio\s+imediato|s[oó]\s+hoje|garantia|parcelamento)\b/i;
const categorias: Record<string, string> = {
  PROCESSADOR: 'Processador',
  PLACA_VIDEO: 'Placa de vídeo',
  PLACA_MAE: 'Placa-mãe',
  MEMORIA_RAM: 'Memória RAM',
  ARMAZENAMENTO: 'Armazenamento',
  FONTE: 'Fonte',
  GABINETE: 'Gabinete',
  COOLER: 'Cooler',
  VENTOINHA: 'Ventoinha',
  MONITOR: 'Monitor',
  MOUSE: 'Mouse',
  TECLADO: 'Teclado',
  HEADSET: 'Headset',
  FONE: 'Fone de ouvido',
  CELULAR: 'Celular',
  NOTEBOOK: 'Notebook',
  PC_MONTADO: 'PC montado',
};

function texto(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  const entidades: Record<string, string> = {
    amp: '&',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    lt: '<',
    gt: '>',
  };
  return valor
    .replace(
      /&(#x[0-9a-f]+|#\d+|amp|quot|apos|nbsp|lt|gt);/gi,
      (original, key: string) => {
        if (!key.startsWith('#'))
          return entidades[key.toLowerCase()] ?? original;
        const code =
          key[1].toLowerCase() === 'x'
            ? parseInt(key.slice(2), 16)
            : Number(key.slice(1));
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
      },
    )
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(?:br\s*\/?|\/p|\/div|\/h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function titulo(valor: unknown): string {
  return texto(valor)
    .replace(
      /^\s*(?:nome(?:\s+(?:t[eé]cnico|do\s+produto))?|produto|t[ií]tulo)\s*:\s*/i,
      '',
    )
    .replace(
      /^(?:conhe[cç]a|descubra|apresentamos)\s+(?:(?:o|a|os|as)\s+)?/i,
      '',
    )
    .replace(
      /[[(][^\])]*(?:frete\s+gr[aá]tis|promo[cç][aã]o|oferta)[^\])]*[\])]/gi,
      '',
    )
    .replace(
      /\s+\|\s+(?:amazon(?:\.com\.br)?|kabum|pichau|terabyte|mercado\s*livre|shopee|magalu|loja\b).*$/i,
      '',
    )
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—|,;:]+|[\s\-–—|,;:]+$/g, '');
}

/** Não remove termos de modelo como Gaming, Pro, Plus, Super, Ti e capacidades. */
export function normalizarNomeTecnico(
  valor: unknown,
  identidade: IdentidadeTexto = {},
): string {
  const linhas = texto(valor)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let nome = titulo(linhas[0] || valor);
  const corte = narrativa.exec(nome) ?? comercial.exec(nome);
  if (corte) nome = nome.slice(0, corte.index).replace(/[\s\-–—|,;:.!]+$/g, '');
  nome = nome
    .split(/[.!?]\s+(?=[A-ZÀ-Ý])/)[0]
    .replace(/\s*[-–—:]?\s*R\$.*$/, '')
    .trim();
  if (nome && nome.length <= 200 && nome.split(/\s+/).length <= 28) return nome;
  const marca = titulo(identidade.marca),
    modelo = titulo(identidade.modelo);
  if (
    modelo &&
    modelo.length <= 100 &&
    !narrativa.test(modelo) &&
    !comercial.test(modelo)
  ) {
    const partes = [
      categorias[String(identidade.categoria ?? '')] || '',
      marca,
      modelo,
    ];
    return partes
      .filter(
        (parte, i) =>
          parte &&
          !partes
            .slice(i + 1)
            .some((outro) => outro.toLowerCase().includes(parte.toLowerCase())),
      )
      .join(' ')
      .slice(0, 200)
      .trim();
  }
  if (nome && !narrativa.test(nome)) {
    const limite = nome.slice(0, 200);
    return limite.includes(' ')
      ? limite.slice(0, limite.lastIndexOf(' ')).replace(/[\s\-–—|,;:]+$/g, '')
      : '';
  }
  return '';
}

export function descricaoTecnica(
  especificacoes: Record<string, unknown>,
  nome = '',
): string {
  const labels: Record<string, string> = {
    socket: 'Soquete',
    nucleos: 'Núcleos',
    threads: 'Threads',
    ramGb: 'Memória RAM',
    memoriaVideoGb: 'Memória de vídeo',
    armazenamentoGb: 'Armazenamento',
    capacidadeGb: 'Capacidade',
    bateriaMah: 'Bateria',
    resolucao: 'Resolução',
    processadorNome: 'Processador',
  };
  const unidades: Record<string, string> = {
    Gb: 'GB',
    Mb: 'MB',
    Mhz: 'MHz',
    Hz: 'Hz',
    Watts: 'W',
    Mm: 'mm',
    Ms: 'ms',
    Volts: 'V',
    Mah: 'mAh',
    Polegadas: 'pol.',
    Gramas: 'g',
  };
  const fatos = Object.entries(especificacoes)
    .filter(
      ([chave]) =>
        ![
          'id',
          'produtoId',
          'hardwareId',
          'criadoEm',
          'atualizadoEm',
          'nome',
          'descricao',
          'origem',
          'fontes',
          'url',
          'metodo',
          '__proto__',
          'constructor',
          'prototype',
        ].includes(chave) &&
        !/pre[cç]o|price|frete|shipping|hist[oó]ria|history/i.test(chave),
    )
    .flatMap(([chave, valor]) => {
      if (
        valor === null ||
        valor === undefined ||
        valor === '' ||
        (Array.isArray(valor) && !valor.length)
      )
        return [];
      if (
        typeof valor === 'object' &&
        (!Array.isArray(valor) ||
          valor.some((item) => typeof item === 'object'))
      )
        return [];
      let exibido =
        typeof valor === 'boolean'
          ? valor
            ? 'Sim'
            : 'Não'
          : Array.isArray(valor)
            ? valor.join(', ')
            : String(valor);
      if (
        exibido.length > 180 ||
        narrativa.test(exibido) ||
        comercial.test(exibido)
      )
        return [];
      if (typeof valor === 'number') {
        const unidade = Object.entries(unidades).find(([final]) =>
          chave.endsWith(final),
        )?.[1];
        if (unidade) exibido += ` ${unidade}`;
      }
      const rotulo =
        labels[chave] ||
        chave
          .replace(
            /(?:Gb|Mb|Mhz|Hz|Watts|Mm|Ms|Volts|Mah|Polegadas|Gramas)$/,
            '',
          )
          .replace(/([a-z])([A-Z])/g, '$1 $2');
      return [`${rotulo[0].toUpperCase()}${rotulo.slice(1)}: ${exibido}`];
    })
    .slice(0, 12);
  return fatos.length ? [nome, ...fatos].filter(Boolean).join('\n') : '';
}

export function exigirNomeTecnico(
  valor: unknown,
  identidade: IdentidadeTexto = {},
): string {
  const nome = normalizarNomeTecnico(valor, identidade);
  if (nome.length < 2)
    throw new BadRequestException(
      'Informe o nome técnico do produto, com marca e modelo.',
    );
  return nome;
}
