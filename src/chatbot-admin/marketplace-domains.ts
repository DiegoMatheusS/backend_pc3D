const MAGALU_DOMINIOS = [
  'magazineluiza.com.br',
  'magazinevoce.com.br',
  'magalu.com',
] as const;

function normalizarHost(valor: string): string {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./u, '');
}

function pertenceAoDominio(host: string, dominio: string): boolean {
  return host === dominio || host.endsWith(`.${dominio}`);
}

function pertenceAoGrupo(host: string, dominios: readonly string[]): boolean {
  return dominios.some((dominio) => pertenceAoDominio(host, dominio));
}

export function ehHostShopee(hostEntrada: string): boolean {
  const host = normalizarHost(hostEntrada);
  return pertenceAoDominio(host, 'shopee.com.br');
}

export function hostCompativelComParceiro(
  hostEntrada: string,
  dominioParceiroEntrada: string | null | undefined,
): boolean {
  const host = normalizarHost(hostEntrada);
  const dominioParceiro = normalizarHost(dominioParceiroEntrada || '');
  if (!host || !dominioParceiro) return false;

  if (pertenceAoDominio(host, dominioParceiro)) return true;

  return (
    pertenceAoGrupo(host, MAGALU_DOMINIOS) &&
    pertenceAoGrupo(dominioParceiro, MAGALU_DOMINIOS)
  );
}
