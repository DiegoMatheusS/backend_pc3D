/* Pré-busca conservadora para processadores já cadastrados por outra loja.
 * O modelo e o sufixo precisam coincidir: 5700, 5700G e 5700X são distintos.
 */
export type ProdutoCpu = {
  id: number;
  nome: string;
  marca?: string | null;
  modelo?: string | null;
  publicado?: boolean;
  categoria?: { slug?: string | null } | null;
  hardware?: { id: number; categoria?: string | null } | null;
};

export type HardwareCpu = {
  id: number;
  nome: string;
  marca?: string | null;
  modelo?: string | null;
  publicado?: boolean;
  categoria?: string | null;
  produtoId?: number | null;
};

export type CandidatoCpu = {
  tipo: 'PRODUTO' | 'HARDWARE';
  id: number;
  nome: string;
  marca?: string | null;
  modelo?: string | null;
  publicado?: boolean;
};

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

export function assinaturaCpu(valor: unknown): string | null {
  const texto = normalizar(valor);
  // Uma CPU mencionada no título de um PC não identifica o equipamento completo.
  if (/^(computador|pc|desktop|notebook)\b/u.test(texto)) return null;

  const ryzen = /\bryzen\s*([3579])\s*(\d{4,5})(?:\s*(x3d|xt|gt|ge|g|x|f))?(?![a-z0-9])/u.exec(texto);
  if (ryzen) return `amd:ryzen:${ryzen[1]}:${ryzen[2]}:${ryzen[3] || ''}`;

  const intel = /\b(?:intel\s+)?core\s*i\s*([3579])\s*(\d{4,5})(?:\s*(ks|kf|hx|hk|xe|t|k|f|h|u))?(?![a-z0-9])/u.exec(texto);
  if (intel) return `intel:core-i${intel[1]}:${intel[2]}:${intel[3] || ''}`;
  return null;
}

function corresponde(assinatura: string, item: { nome?: unknown; modelo?: unknown; marca?: unknown }): boolean {
  const reconhecidas = [assinaturaCpu(item.nome), assinaturaCpu(item.modelo)]
    .filter((valor): valor is string => Boolean(valor));
  if (!reconhecidas.length || !reconhecidas.every((valor) => valor === assinatura)) return false;
  const marca = normalizar(item.marca);
  if (marca && assinatura.startsWith('amd:') && !marca.includes('amd')) return false;
  if (marca && assinatura.startsWith('intel:') && !marca.includes('intel')) return false;
  return true;
}

export function buscarCpuPorTitulo(
  titulo: string,
  produtos: readonly ProdutoCpu[],
  hardwares: readonly HardwareCpu[],
): CandidatoCpu[] {
  const assinatura = assinaturaCpu(titulo);
  if (!assinatura) return [];

  const candidatos: CandidatoCpu[] = [];
  const produtoIds = new Set<number>();
  const hardwareVinculadoIds = new Set<number>();

  for (const produto of produtos) {
    const categoria = normalizar(produto.categoria?.slug);
    const hardware = produto.hardware;
    const ehProcessador = normalizar(hardware?.categoria) === 'processador' || categoria === 'processadores';
    if (!ehProcessador || !corresponde(assinatura, produto)) continue;
    produtoIds.add(produto.id);
    if (hardware?.id) hardwareVinculadoIds.add(hardware.id);
    candidatos.push({
      tipo: 'PRODUTO', id: produto.id, nome: produto.nome,
      marca: produto.marca, modelo: produto.modelo, publicado: produto.publicado,
    });
  }

  for (const hardware of hardwares) {
    if (normalizar(hardware.categoria) !== 'processador') continue;
    if (hardwareVinculadoIds.has(hardware.id) || (hardware.produtoId && produtoIds.has(hardware.produtoId))) continue;
    if (!corresponde(assinatura, hardware)) continue;
    candidatos.push({
      tipo: 'HARDWARE', id: hardware.id, nome: hardware.nome,
      marca: hardware.marca, modelo: hardware.modelo, publicado: hardware.publicado,
    });
  }
  return candidatos;
}
