import { postProdutoIa } from './produto-ia-http';
import {
  BadGatewayException,
  BadRequestException,
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
  analiseComputador?: Record<string, unknown>;
  iaTecnicaAutomatica?: Record<string, unknown>;
  origemPorCampo?: Record<string, unknown>;
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
  detalharPagina?: boolean;
  urlAfiliada?: string;
};

export type RequisicaoMetaAiWhatsappProdutoIa = {
  categoria: string;
  nome?: string;
  payload: Record<string, unknown>;
  resposta?: string;
  captura?: Record<string, unknown>;
  forcar?: boolean;
};

export type ResultadoMetaAiWhatsappProdutoIa = Record<string, unknown>;

export type RequisicaoIaTecnicaProdutoIa = {
  provedor: string;
  categoria: string;
  nome?: string;
  payload: Record<string, unknown>;
  somentePreencheLacunas?: boolean;
};

export type ResultadoIaTecnicaProdutoIa = Record<string, unknown>;

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

    const endpoint = `${this.normalizarProdutoIaUrl(produtoIaUrl)}/descobrir-hardwares`;
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
      const resposta = await postProdutoIa(endpoint, {
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

  private extrairMensagemErro(texto: string): string | null {
    const limpo = texto.trim();
    if (!limpo) return null;

    try {
      const parsed: unknown = JSON.parse(limpo);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const registro = parsed as Record<string, unknown>;
        const detail = registro.detail;
        const message = registro.message;

        if (typeof detail === 'string' && detail.trim()) return detail.trim();
        if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
          const nested = detail as Record<string, unknown>;
          const mensagem = nested.mensagem ?? nested.message;
          if (typeof mensagem === 'string' && mensagem.trim())
            return mensagem.trim();
        }
        if (typeof message === 'string' && message.trim())
          return message.trim();
      }
    } catch {
      return null;
    }

    return null;
  }

  async enriquecerIaTecnica(
    dados: RequisicaoIaTecnicaProdutoIa,
  ): Promise<ResultadoIaTecnicaProdutoIa> {
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

    const endpoint = `${this.normalizarProdutoIaUrl(produtoIaUrl)}/ia-tecnica/enriquecer`;
    const controller = new AbortController();
    const timeoutConfigurado = Number(
      process.env.PRODUTO_IA_IA_TECNICA_TIMEOUT_MS ??
        process.env.PRODUTO_IA_TIMEOUT_MS ??
        120_000,
    );
    const timeoutMs =
      Number.isFinite(timeoutConfigurado) && timeoutConfigurado >= 5_000
        ? Math.min(timeoutConfigurado, 240_000)
        : 120_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resposta = await postProdutoIa(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          provedor: dados.provedor,
          categoria: dados.categoria,
          nome: dados.nome ?? null,
          payload: dados.payload,
          somentePreencheLacunas: dados.somentePreencheLacunas ?? true,
        }),
        signal: controller.signal,
      });

      const texto = await resposta.text();

      if (!resposta.ok) {
        const mensagem = this.extrairMensagemErro(texto);

        if (resposta.status === 400 || resposta.status === 422) {
          throw new BadRequestException(
            mensagem ??
              'A Produto IA recusou o payload de enriquecimento técnico.',
          );
        }

        if (resposta.status === 401 || resposta.status === 403) {
          this.logger.error(
            `Produto IA IA técnica respondeu com HTTP ${resposta.status}.`,
          );
          throw new BadGatewayException(
            'Falha de autenticação entre o backend e a Produto IA.',
          );
        }

        if (resposta.status === 429) {
          throw new BadGatewayException(
            mensagem ?? 'O provedor de IA técnica atingiu o limite temporário.',
          );
        }

        this.logger.error(
          `Produto IA IA técnica respondeu com HTTP ${resposta.status}.`,
        );
        throw new BadGatewayException(
          mensagem
            ? `Produto IA não conseguiu enriquecer a ficha: ${mensagem}`
            : `Produto IA respondeu com HTTP ${resposta.status} no enriquecimento técnico.`,
        );
      }

      let resultado: unknown;
      try {
        resultado = JSON.parse(texto);
      } catch {
        throw new BadGatewayException(
          'A Produto IA não retornou JSON válido no enriquecimento técnico.',
        );
      }

      if (
        !resultado ||
        typeof resultado !== 'object' ||
        Array.isArray(resultado)
      ) {
        throw new BadGatewayException(
          'A Produto IA retornou formato inválido no enriquecimento técnico.',
        );
      }

      return resultado as ResultadoIaTecnicaProdutoIa;
    } catch (erro) {
      if (
        erro instanceof BadGatewayException ||
        erro instanceof BadRequestException ||
        erro instanceof ServiceUnavailableException
      ) {
        throw erro;
      }

      const mensagem =
        erro instanceof Error ? erro.message : 'erro desconhecido';

      if (erro instanceof Error && erro.name === 'AbortError') {
        this.logger.error(
          'Timeout ao consultar enriquecimento técnico na Produto IA.',
        );
        throw new BadGatewayException(
          'Tempo limite excedido ao completar a ficha com IA técnica.',
        );
      }

      this.logger.error(
        `Falha ao consultar enriquecimento técnico na Produto IA: ${mensagem}`,
      );
      throw new BadGatewayException(
        'Falha ao completar a ficha com IA técnica.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async enriquecerMetaAiWhatsapp(
    dados: RequisicaoMetaAiWhatsappProdutoIa,
  ): Promise<ResultadoMetaAiWhatsappProdutoIa> {
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

    const endpoint = `${this.normalizarProdutoIaUrl(produtoIaUrl)}/meta-ai-whatsapp/enriquecer`;
    const controller = new AbortController();
    const timeoutConfigurado = Number(
      process.env.PRODUTO_IA_META_AI_WHATSAPP_TIMEOUT_MS ??
        process.env.PRODUTO_IA_TIMEOUT_MS ??
        90_000,
    );
    const timeoutMs =
      Number.isFinite(timeoutConfigurado) && timeoutConfigurado >= 5_000
        ? Math.min(timeoutConfigurado, 180_000)
        : 90_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resposta = await postProdutoIa(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          categoria: dados.categoria,
          nome: dados.nome ?? null,
          payload: dados.payload,
          resposta: dados.resposta ?? null,
          captura: dados.captura ?? null,
          forcar: dados.forcar ?? false,
        }),
        signal: controller.signal,
      });

      const texto = await resposta.text();

      if (!resposta.ok) {
        const mensagem = this.extrairMensagemErro(texto);

        if (resposta.status === 400) {
          throw new BadRequestException(
            mensagem ?? 'A resposta do Meta AI não pôde ser analisada.',
          );
        }

        if (resposta.status === 401 || resposta.status === 403) {
          this.logger.error(
            `Produto IA Meta AI/WhatsApp respondeu com HTTP ${resposta.status}.`,
          );
          throw new BadGatewayException(
            'Falha de autenticação entre o backend e a Produto IA.',
          );
        }

        this.logger.error(
          `Produto IA Meta AI/WhatsApp respondeu com HTTP ${resposta.status}.`,
        );
        throw new BadGatewayException(
          mensagem
            ? `Produto IA não conseguiu enriquecer a ficha: ${mensagem}`
            : `Produto IA respondeu com HTTP ${resposta.status} ao enriquecer a ficha.`,
        );
      }

      let resultado: unknown;
      try {
        resultado = JSON.parse(texto);
      } catch {
        throw new BadGatewayException(
          'A Produto IA não retornou JSON válido no enriquecimento Meta AI/WhatsApp.',
        );
      }

      if (
        !resultado ||
        typeof resultado !== 'object' ||
        Array.isArray(resultado)
      ) {
        throw new BadGatewayException(
          'A Produto IA retornou formato inválido no enriquecimento Meta AI/WhatsApp.',
        );
      }

      return resultado as ResultadoMetaAiWhatsappProdutoIa;
    } catch (erro) {
      if (
        erro instanceof BadGatewayException ||
        erro instanceof BadRequestException
      ) {
        throw erro;
      }

      const mensagem =
        erro instanceof Error ? erro.message : 'erro desconhecido';

      if (erro instanceof Error && erro.name === 'AbortError') {
        this.logger.error(
          'Timeout ao consultar enriquecimento Meta AI/WhatsApp na Produto IA.',
        );
        throw new BadGatewayException(
          'Tempo limite excedido ao completar a ficha com o Meta AI.',
        );
      }

      this.logger.error(
        `Falha ao consultar enriquecimento Meta AI/WhatsApp na Produto IA: ${mensagem}`,
      );
      throw new BadGatewayException(
        'Falha ao completar a ficha com o Meta AI.',
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
      process.env.PRODUTO_IA_TIMEOUT_MS ??
        (opcoes.detalharPagina ? 180_000 : 90_000),
    );
    const timeoutMs =
      Number.isFinite(timeoutConfigurado) && timeoutConfigurado >= 5_000
        ? Math.min(timeoutConfigurado, 180_000)
        : 90_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resposta = await postProdutoIa(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          url,
          urlAfiliada: opcoes.urlAfiliada ?? null,
          categoria: categoria ?? null,
          enrich: opcoes.enrich ?? false,
          criabytePlan: opcoes.criabytePlan ?? false,
          noBrowser: opcoes.noBrowser ?? false,
          ...(opcoes.detalharPagina !== undefined
            ? { detalharPagina: opcoes.detalharPagina }
            : {}),
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
