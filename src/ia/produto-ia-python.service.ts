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
  cadastroSugerido?: {
    payload?: Record<string, unknown>;
    prontoParaCadastrar?: boolean;
    camposObrigatoriosAusentes?: string[];
  } | null;
  ofertaColetada?: Record<string, unknown>;
  informacoesProdutoEncontradas?: unknown[];
  especificacoesEncontradas?: Record<string, unknown>;
  analiseProduto?: Record<string, unknown>;
  camposEspecificacaoEsperados?: string[];
  camposObrigatoriosAusentes?: string[];
  origemColeta?: Record<string, unknown>;
  politicaColeta?: Record<string, unknown>;
  marketplace?: Record<string, unknown>;
  reconciliacao?: Record<string, unknown>;
  servicoProdutoIa?: {
    versao?: string | null;
    modo?: string | null;
    integracao?: string | null;
    proveniencia?: string | null;
  } | null;
  fonte?: string | null;
  erro?: string | null;
};

export type ResultadoDescobertaHardwareProdutoIa = {
  itens?: unknown[];
  hardwares?: unknown[];
  resultados?: unknown[];
  dados?: unknown[];
  totalEncontrados?: number | null;
  pagina?: number | null;
  proximaPagina?: number | null;
  temMais?: boolean | null;
  erro?: string | null;
  servicoProdutoIa?: {
    versao?: string | null;
    modo?: string | null;
    integracao?: string | null;
    proveniencia?: string | null;
  } | null;
};

export type OpcoesDescobertaHardwareProdutoIa = {
  categoria: string;
  marca?: string;
  limite?: number;
  pagina?: number;
};

export type OpcoesProdutoIa = {
  enrich?: boolean;
  criabytePlan?: boolean;
  noBrowser?: boolean;
};

@Injectable()
export class ProdutoIaPythonService {
  private readonly logger = new Logger(ProdutoIaPythonService.name);

  private normalizarProdutoIaUrl(valor: string): string {
    return valor.trim().replace(/\/+$/, '');
  }

  async descobrirHardwares(
    opcoes: OpcoesDescobertaHardwareProdutoIa,
  ): Promise<ResultadoDescobertaHardwareProdutoIa> {
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

    const endpoint = `${this.normalizarProdutoIaUrl(produtoIaUrl)}/v1/descobrir-hardwares`;
    const controller = new AbortController();
    const timeoutConfigurado = Number(
      process.env.PRODUTO_IA_DESCOBERTA_TIMEOUT_MS ??
        process.env.PRODUTO_IA_TIMEOUT_MS ??
        120_000,
    );
    const timeoutMs =
      Number.isFinite(timeoutConfigurado) && timeoutConfigurado >= 5_000
        ? Math.min(timeoutConfigurado, 240_000)
        : 120_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resposta = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          categoria: opcoes.categoria,
          marca: opcoes.marca ?? null,
          limite: opcoes.limite ?? 50,
          pagina: opcoes.pagina ?? 1,
        }),
        signal: controller.signal,
      });

      const texto = await resposta.text();

      if (!resposta.ok) {
        this.logger.error(
          `Produto IA descoberta HTTP ${resposta.status}: ${texto.slice(0, 1000)}`,
        );
        throw new BadGatewayException(
          `Produto IA respondeu com HTTP ${resposta.status} na descoberta de Hardwares.`,
        );
      }

      let resultado: unknown;
      try {
        resultado = JSON.parse(texto);
      } catch {
        throw new BadGatewayException(
          'A Produto IA não retornou JSON válido na descoberta de Hardwares.',
        );
      }

      if (
        !resultado ||
        typeof resultado !== 'object' ||
        Array.isArray(resultado)
      ) {
        throw new BadGatewayException(
          'A Produto IA retornou formato inválido na descoberta de Hardwares.',
        );
      }

      return resultado;
    } catch (erro) {
      if (erro instanceof BadGatewayException) throw erro;

      const mensagem =
        erro instanceof Error ? erro.message : 'erro desconhecido';
      if (erro instanceof Error && erro.name === 'AbortError') {
        this.logger.error(
          'Timeout ao consultar descoberta de Hardwares na Produto IA.',
        );
        throw new BadGatewayException(
          'Tempo limite excedido ao descobrir Hardwares na Produto IA.',
        );
      }

      this.logger.error(
        `Falha ao consultar descoberta de Hardwares na Produto IA: ${mensagem}`,
      );
      throw new BadGatewayException(
        `Falha na descoberta de Hardwares da Produto IA: ${mensagem}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async importarUrl(
    url: string,
    categoria?: CategoriaImportacaoIa,
    opcoes: OpcoesProdutoIa = {},
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
    const timeoutConfigurado = Number(
      process.env.PRODUTO_IA_TIMEOUT_MS ?? 90_000,
    );
    const timeoutMs =
      Number.isFinite(timeoutConfigurado) && timeoutConfigurado >= 5_000
        ? Math.min(timeoutConfigurado, 180_000)
        : 90_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
          enrich: opcoes.enrich ?? false,
          criabytePlan: opcoes.criabytePlan ?? false,
          noBrowser: opcoes.noBrowser ?? false,
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
