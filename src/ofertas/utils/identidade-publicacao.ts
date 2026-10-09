type Publicacao = {
  urlOriginal?: unknown;
  codigoMarketplace?: unknown;
  vendedorIdentificador?: unknown;
};

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '');
}

function urlPublicacao(valor: unknown): URL | null {
  try {
    const url = new URL(String(valor ?? '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function itemMercadoLivre(url: URL | null): string {
  if (
    !url ||
    !/(^|\.)(mercadolivre\.com(?:\.br)?|mercadolibre\.com)$/iu.test(
      url.hostname,
    )
  )
    return '';
  const parametros = [url.searchParams, new URLSearchParams(url.hash.slice(1))];
  for (const params of parametros) {
    for (const chave of ['item_id', 'wid', 'pdp_filters']) {
      for (const valor of params.getAll(chave)) {
        const match =
          chave === 'pdp_filters'
            ? /item_id\s*:\s*(MLB-?\d{6,})\b/iu.exec(valor)
            : /\b(MLB-?\d{6,})\b/iu.exec(valor);
        if (match) return normalizar(match[1]);
      }
    }
  }
  // /p/MLB... identifica o catálogo compartilhado, não um anúncio.
  if (/\/p\/MLB\d+/iu.test(url.pathname)) return '';
  return normalizar(/\/(MLB-?\d{6,})(?:[-/]|$)/iu.exec(url.pathname)?.[1]);
}

export function mesmaPublicacaoMarketplace(
  atual: Publicacao,
  nova: Publicacao,
): boolean {
  const vendedorAtual = normalizar(atual.vendedorIdentificador);
  const vendedorNovo = normalizar(nova.vendedorIdentificador);
  if (vendedorAtual && vendedorNovo && vendedorAtual !== vendedorNovo)
    return false;

  const urlAtual = urlPublicacao(atual.urlOriginal);
  const urlNova = urlPublicacao(nova.urlOriginal);
  const codigoAtual = normalizar(atual.codigoMarketplace);
  const codigoNovo = normalizar(nova.codigoMarketplace);
  const itemAtual = itemMercadoLivre(urlAtual);
  const itemNovo = itemMercadoLivre(urlNova);
  if (itemAtual || itemNovo) {
    // A identidade específica prevalece sobre URL de catálogo e código legado.
    return Boolean(
      (itemAtual || codigoAtual) &&
      (itemAtual || codigoAtual) === (itemNovo || codigoNovo),
    );
  }
  if (codigoAtual && codigoNovo) return codigoAtual === codigoNovo;
  if (!urlAtual || !urlNova) return false;
  const canonica = (url: URL) =>
    `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/u, '') || '/'}`;
  return canonica(urlAtual) === canonica(urlNova);
}
