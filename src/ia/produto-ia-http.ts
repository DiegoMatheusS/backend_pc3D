import { BadGatewayException } from '@nestjs/common';

// Preserva POST/JSON em redirects internos sem enviar a chave a outra origem.
export async function postProdutoIa(endpoint: string, options: RequestInit): Promise<Response> {
  let current = new URL(endpoint);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(current.href, { ...options, method: 'POST', redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || redirects === 3) {
      throw new BadGatewayException('Redirecionamento inválido ou excessivo na Produto IA.');
    }
    const next = new URL(location, current);
    const httpsUpgrade = current.protocol === 'http:' && next.protocol === 'https:'
      && current.hostname === next.hostname && !current.port && !next.port;
    if (next.username || next.password || (next.origin !== current.origin && !httpsUpgrade)) {
      throw new BadGatewayException('A Produto IA redirecionou para outra origem. Configure a URL final no backend.');
    }
    if (response.status === 303) {
      throw new BadGatewayException('A Produto IA solicitou converter POST em GET. Configure o endpoint final.');
    }
    current = next;
  }
  throw new BadGatewayException('Não foi possível consultar a Produto IA.');
}
