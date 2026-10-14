type Registro = Record<string, unknown>;

export function registro(valor: unknown): Registro {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Registro)
    : {};
}

export function vazio(valor: unknown): boolean {
  return (
    valor === undefined ||
    valor === null ||
    valor === '' ||
    (typeof valor === 'string' && !valor.trim()) ||
    (Array.isArray(valor) && valor.length === 0)
  );
}

export function especificacoesMetadados(valor: unknown): Registro {
  const dados = registro(valor);
  return {
    ...registro(dados.especificacoesEncontradas),
    ...registro(dados.especificacoes),
  };
}

export function metadadosComCelular(
  metadados: unknown,
  especificacao?: object,
): Registro {
  const dados = registro(metadados);
  return especificacao
    ? {
        ...dados,
        especificacoes: { ...especificacoesMetadados(dados), ...especificacao },
      }
    : dados;
}

export function preencherLacunas(
  atual: Registro,
  encontrado: Registro,
): Registro {
  const resultado = { ...atual };
  for (const [campo, valor] of Object.entries(encontrado)) {
    if (
      [
        'id',
        'hardwareId',
        'produtoId',
        'criadoEm',
        'atualizadoEm',
        '__proto__',
        'constructor',
        'prototype',
      ].includes(campo)
    )
      continue;
    if (vazio(resultado[campo]) && !vazio(valor)) resultado[campo] = valor;
  }
  return resultado;
}
