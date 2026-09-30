/*
 * URLs de resultados de busca da Amazon incluem tokens de sessão e consultas
 * enormes sem relação com o produto. Conservar o ASIN e os parâmetros de
 * afiliado evita o limite atual de 500 caracteres do banco sem quebrar links.
 * Nunca encurta URLs de outras lojas nem links sem um ASIN reconhecível.
 */
const AMAZON_HOSTS = ['amazon.com.br', 'amazon.com', 'amazon.es', 'amazon.de', 'amazon.co.uk'];
const AFFILIATE_PARAMS = [
  'tag', 'ascsubtag', 'linkCode', 'creative', 'creativeASIN', 'camp',
  'ref_', 'th', 'psc',
];

export function normalizarUrlAmazon(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const original = value.trim();
  if (!original) return original;

  try {
    const url = new URL(original);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return original;
    if (!AMAZON_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return original;
    }

    const match = url.pathname.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?=\/|$)/i);
    if (!match) return original;

    // Um domínio da própria URL é preservado (país/região), e o slug/ref de
    // busca é removido. Os parâmetros necessários à atribuição permanecem.
    const canonical = new URL(`${url.protocol}//${host}/dp/${match[1].toUpperCase()}`);
    for (const key of AFFILIATE_PARAMS) {
      for (const item of url.searchParams.getAll(key)) {
        canonical.searchParams.append(key, item);
      }
    }
    const shortened = canonical.toString();
    // Não destruir um link de afiliado excepcionalmente grande. Em vez disso,
    // deixar a validação existente rejeitá-lo explicitamente.
    return shortened.length < original.length ? shortened : original;
  } catch {
    return original;
  }
}
