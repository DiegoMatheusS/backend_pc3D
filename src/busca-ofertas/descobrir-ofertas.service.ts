import {
  Injectable,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { postProdutoIa } from '../ia/produto-ia-http';
import { DescobrirOfertasDto } from './dtos/descobrir-ofertas.dto';
@Injectable()
export class DescobrirOfertasService {
  status() {
    return {
      projetoIaConfigurado: Boolean(
        process.env.PRODUTO_IA_URL?.trim() &&
        process.env.PRODUTO_IA_API_KEY?.trim(),
      ),
      lojas: ['SHOPEE', 'MERCADO_LIVRE', 'MAGALU'],
    };
  }
  async buscar(dados: DescobrirOfertasDto) {
    const base = process.env.PRODUTO_IA_URL?.trim().replace(/\/+$/, ''),
      key = process.env.PRODUTO_IA_API_KEY?.trim();
    if (!base || !key)
      throw new ServiceUnavailableException(
        'Integração de busca não configurada.',
      );
    try {
      const response = await postProdutoIa(`${base}/ofertas/descobrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({ ...dados, consulta: dados.consulta.trim() }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new BadGatewayException(
          'Não foi possível consultar a loja agora. Tente novamente ou use a extensão.',
        );
      const body: unknown = await response.json();
      if (
        !body ||
        typeof body !== 'object' ||
        !Array.isArray((body as Record<string, unknown>).itens)
      )
        throw new BadGatewayException('A busca retornou dados inválidos.');
      return body;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        'A loja está temporariamente indisponível para busca. Tente novamente ou use a extensão.',
      );
    }
  }
}
