import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { CategoriaImportacaoIa } from './dtos/categoria-importacao-ia';

export type ResultadoProdutoIaPython = {
  categoriaDetectada?: string | null;
  categoriaSlugSugerida?: string | null;
  tipoCadastro?: string | null;
  payloadParcialBackend?: Record<string, unknown>;
  ofertaColetada?: Record<string, unknown>;
  informacoesProdutoEncontradas?: unknown[];
  especificacoesEncontradas?: Record<string, unknown>;
  analiseProduto?: Record<string, unknown>;
  camposEspecificacaoEsperados?: string[];
  camposObrigatoriosAusentes?: string[];
  origemColeta?: Record<string, unknown>;
  politicaColeta?: Record<string, unknown>;
  marketplace?: Record<string, unknown>;
  fonte?: string | null;
  erro?: string | null;
};

@Injectable()
export class ProdutoIaPythonService {
  private readonly logger = new Logger(ProdutoIaPythonService.name);

  private normalizarProdutoIaUrl(valor: string): string {
    return valor.trim().replace(/\/+$/, '');
  }

  async importarUrl(
    url: string,
    categoria?: CategoriaImportacaoIa,
  ): Promise<ResultadoProdutoIaPython> {
    const produtoIaUrl = process.env.PRODUTO_IA_URL?.trim();
    const apiKey = process.env.PRODUTO_IA_API_KEY?.trim();

    if (!produtoIaUrl) {
      throw new ServiceUnavailableException(
        'Produto IA não configurada. Defina PRODUTO_IA_URL no ambiente do backend.',
      );
    }

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Produto IA não configurada. Defina PRODUTO_IA_API_KEY no ambiente do backend.',
      );
    }

    const endpoint = `${this.normalizarProdutoIaUrl(produtoIaUrl)}/analisar`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      const resposta = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          url,
          categoria: categoria ?? null,
          enrich: false,
          criabytePlan: false,
          noBrowser: false,
        }),
        signal: controller.signal,
      });

      const texto = await resposta.text();

      if (!resposta.ok) {
        this.logger.error(
          `Produto IA HTTP ${resposta.status}: ${texto.slice(0, 1000)}`,
        );
        throw new BadGatewayException(
          `Produto IA respondeu com HTTP ${resposta.status}.`,
        );
      }

      let resultado: unknown;
      try {
        resultado = JSON.parse(texto);
      } catch {
        throw new BadGatewayException('A Produto IA não retornou JSON válido.');
      }

      if (
        !resultado ||
        typeof resultado !== 'object' ||
        Array.isArray(resultado)
      ) {
        throw new BadGatewayException(
          'A Produto IA retornou um formato inválido.',
        );
      }

      return resultado;
    } catch (erro) {
      if (erro instanceof BadGatewayException) throw erro;

      const mensagem =
        erro instanceof Error ? erro.message : 'erro desconhecido';

      if (erro instanceof Error && erro.name === 'AbortError') {
        this.logger.error('Timeout ao chamar a Produto IA via HTTP.');
        throw new BadGatewayException(
          'Tempo limite excedido ao consultar a Produto IA.',
        );
      }

      this.logger.error(`Falha ao chamar Produto IA via HTTP: ${mensagem}`);
      throw new BadGatewayException(`Falha na Produto IA: ${mensagem}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
