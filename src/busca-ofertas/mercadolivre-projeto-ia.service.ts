import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StatusOferta } from '../generated/prisma/enums';
import { postProdutoIa } from '../ia/produto-ia-http';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultarProdutoMercadoLivreDto } from './dtos/mercadolivre.dto';

export type ProdutoMercadoLivreProjetoIa = {
  fonte?: string;
  marketplace?: string;
  apiOficial?: boolean;
  fallbackUsado?: boolean;
  itemId?: string | null;
  catalogProductId?: string | null;
  codigoMarketplace?: string | null;
  nome?: string | null;
  urlOriginal?: string | null;
  urlFinal?: string | null;
  imagemUrl?: string | null;
  preco?: number | null;
  precoAnterior?: number | null;
  descontoPercentual?: number | null;
  emPromocao?: boolean;
  moeda?: string | null;
  disponivel?: boolean | null;
  vendedorId?: string | number | null;
  categoriaId?: string | null;
  origemPreco?: string | null;
  apiErrors?: string[];
  requiresLocalCapture?: boolean;
};

type RespostaProdutoMercadoLivre = {
  agente?: string;
  modo?: string;
  item?: ProdutoMercadoLivreProjetoIa;
};

@Injectable()
export class MercadoLivreProjetoIaService {
  private readonly logger = new Logger(MercadoLivreProjetoIaService.name);

  constructor(private readonly prisma: PrismaService) {}

  private produtoIaConfig() {
    const baseUrl = process.env.PRODUTO_IA_URL?.trim().replace(/\/+$/, '');
    const apiKey = process.env.PRODUTO_IA_API_KEY?.trim();
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException(
        'ProjetoIA não configurado. Defina PRODUTO_IA_URL e PRODUTO_IA_API_KEY no backend.',
      );
    }
    return { baseUrl, apiKey };
  }

  private extrairMensagemErro(texto: string): string | null {
    try {
      const parsed: unknown = JSON.parse(texto);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const registro = parsed as Record<string, unknown>;
      if (typeof registro.detail === 'string' && registro.detail.trim()) {
        return registro.detail.trim();
      }
      if (typeof registro.message === 'string' && registro.message.trim()) {
        return registro.message.trim();
      }
    } catch {
      return null;
    }
    return null;
  }

  private async post<T>(caminho: string, payload: Record<string, unknown>): Promise<T> {
    const { baseUrl, apiKey } = this.produtoIaConfig();
    const endpoint = `${baseUrl}${caminho.startsWith('/') ? caminho : `/${caminho}`}`;
    const controller = new AbortController();
    const timeoutConfigurado = Number(
      process.env.PRODUTO_IA_MERCADOLIVRE_TIMEOUT_MS ?? 30_000,
    );
    const timeoutMs = Number.isFinite(timeoutConfigurado)
      ? Math.min(Math.max(timeoutConfigurado, 5_000), 90_000)
      : 30_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resposta = await postProdutoIa(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const texto = await resposta.text();

      if (!resposta.ok) {
        const mensagem = this.extrairMensagemErro(texto);
        if (resposta.status === 503) {
          throw new ServiceUnavailableException(
            mensagem ?? 'A API do Mercado Livre ainda não está configurada no ProjetoIA.',
          );
        }
        if (resposta.status === 400 || resposta.status === 422) {
          throw new BadRequestException(mensagem ?? 'Consulta Mercado Livre inválida.');
        }
        this.logger.error(
          `ProjetoIA Mercado Livre HTTP ${resposta.status}: ${texto.slice(0, 1000)}`,
        );
        throw new BadGatewayException(
          mensagem ??
            `ProjetoIA respondeu HTTP ${resposta.status} ao consultar o Mercado Livre.`,
        );
      }

      try {
        return JSON.parse(texto) as T;
      } catch {
        throw new BadGatewayException(
          'ProjetoIA retornou JSON inválido para a consulta Mercado Livre.',
        );
      }
    } catch (erro) {
      if (
        erro instanceof BadRequestException ||
        erro instanceof BadGatewayException ||
        erro instanceof ServiceUnavailableException
      ) {
        throw erro;
      }
      if (erro instanceof Error && erro.name === 'AbortError') {
        throw new BadGatewayException(
          'Tempo limite excedido ao consultar o Mercado Livre pelo ProjetoIA.',
        );
      }
      throw new BadGatewayException(
        `Falha ao consultar o Mercado Livre pelo ProjetoIA: ${
          erro instanceof Error ? erro.message : 'erro desconhecido'
        }`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  consultarProduto(dados: ConsultarProdutoMercadoLivreDto) {
    const url = dados.url?.trim() || undefined;
    const itemId = dados.itemId?.trim() || undefined;
    if (!url && !itemId) {
      throw new BadRequestException(
        'Informe uma URL do Mercado Livre ou o itemId MLB.',
      );
    }
    return this.post<RespostaProdutoMercadoLivre>(
      '/mercadolivre/agente/produto',
      {
        ...(url ? { url } : {}),
        ...(itemId ? { itemId } : {}),
        permitirFallback: dados.permitirFallback ?? true,
      },
    );
  }

  private ehMercadoLivreUrl(valor: string | null | undefined): boolean {
    if (!valor) return false;
    try {
      const host = new URL(valor).hostname.toLowerCase();
      return (
        host === 'meli.la' ||
        host.endsWith('.meli.la') ||
        host === 'mercadolivre.com.br' ||
        host.endsWith('.mercadolivre.com.br') ||
        host === 'mercadolivre.com' ||
        host.endsWith('.mercadolivre.com') ||
        host === 'mercadolibre.com' ||
        host.endsWith('.mercadolibre.com')
      );
    } catch {
      return false;
    }
  }

  private ehParceiroMercadoLivre(parceiro: {
    nome: string;
    slug: string;
    dominio: string | null;
  }): boolean {
    return [parceiro.nome, parceiro.slug, parceiro.dominio]
      .filter((valor): valor is string => Boolean(valor))
      .some((valor) => {
        const alvo = valor.toLowerCase();
        return alvo.includes('mercado livre') || alvo.includes('mercadolivre');
      });
  }

  private extrairItemId(dados: {
    codigoMarketplace: string | null;
    urlOriginal: string;
    urlAfiliada: string | null;
  }): string | null {
    const candidatos = [
      dados.codigoMarketplace,
      dados.urlOriginal,
      dados.urlAfiliada,
    ].filter((valor): valor is string => Boolean(valor));

    for (const valor of candidatos) {
      const direto = /MLB-?(\d{6,})/iu.exec(valor);
      if (direto) return `MLB${direto[1]}`;

      if (/^\d{6,}$/u.test(valor.trim())) {
        return `MLB${valor.trim()}`;
      }

      try {
        const url = new URL(valor);
        for (const filtro of url.searchParams.getAll('pdp_filters')) {
          const match = /item_id\s*:\s*MLB-?(\d{6,})/iu.exec(
            decodeURIComponent(filtro),
          );
          if (match) return `MLB${match[1]}`;
        }
        const queryItem =
          url.searchParams.get('item_id') ?? url.searchParams.get('itemId');
        if (queryItem) {
          const match = /MLB-?(\d{6,})/iu.exec(queryItem);
          if (match) return `MLB${match[1]}`;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private precoValido(valor: unknown): number | null {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0
      ? Number(numero.toFixed(2))
      : null;
  }

  async sincronizarOferta(ofertaId: number) {
    const oferta = await this.prisma.oferta.findUnique({
      where: { id: ofertaId },
      select: {
        id: true,
        preco: true,
        precoAnterior: true,
        frete: true,
        status: true,
        codigoMarketplace: true,
        urlOriginal: true,
        urlAfiliada: true,
        vendedorNome: true,
        vendedorIdentificador: true,
        produto: { select: { id: true, nome: true } },
        parceiro: {
          select: { id: true, nome: true, slug: true, dominio: true },
        },
      },
    });
    if (!oferta) throw new NotFoundException('Oferta não encontrada.');

    const urlMercadoLivre = [oferta.urlOriginal, oferta.urlAfiliada].find((url) =>
      this.ehMercadoLivreUrl(url),
    );
    if (!this.ehParceiroMercadoLivre(oferta.parceiro) && !urlMercadoLivre) {
      throw new BadRequestException(
        'Esta oferta não pertence ao Mercado Livre.',
      );
    }

    const itemId = this.extrairItemId(oferta);
    const resposta = await this.consultarProduto({
      ...(urlMercadoLivre ? { url: urlMercadoLivre } : {}),
      ...(itemId ? { itemId } : {}),
      permitirFallback: true,
    });
    const item = resposta.item;
    if (!item) {
      throw new BadGatewayException(
        'O ProjetoIA não retornou o item do Mercado Livre. O preço salvo foi preservado.',
      );
    }

    const precoBanco = Number(oferta.preco);
    const precoApi = this.precoValido(item.preco);
    const indisponivel = item.disponivel === false;

    if (precoApi === null && !indisponivel) {
      throw new BadGatewayException(
        'A API do Mercado Livre não retornou um preço válido. O preço salvo foi preservado.',
      );
    }

    const precoNovo = precoApi ?? precoBanco;
    const mudouPreco = Math.abs(precoBanco - precoNovo) >= 0.01;
    const anteriorOficial = this.precoValido(item.precoAnterior);
    const promocaoOficial =
      anteriorOficial !== null && anteriorOficial > precoNovo
        ? anteriorOficial
        : null;

    let precoAnteriorNovo: number | null =
      oferta.precoAnterior === null ? null : Number(oferta.precoAnterior);
    if (item.apiOficial === true) {
      precoAnteriorNovo = promocaoOficial;
    } else if (mudouPreco) {
      precoAnteriorNovo = promocaoOficial ?? precoBanco;
    }

    const agora = new Date();
    const codigoMarketplace =
      item.itemId?.trim() || item.codigoMarketplace?.trim() || itemId;
    const vendedorIdentificador =
      item.vendedorId === null || item.vendedorId === undefined
        ? oferta.vendedorIdentificador
        : String(item.vendedorId);

    const urlFinal =
      item.urlFinal?.trim() && this.ehMercadoLivreUrl(item.urlFinal)
        ? item.urlFinal.trim()
        : oferta.urlOriginal;

    const statusNovo =
      item.disponivel === false
        ? StatusOferta.INDISPONIVEL
        : item.disponivel === true
          ? StatusOferta.ATIVA
          : oferta.status;

    const atualizada = await this.prisma.$transaction(async (tx) => {
      const registro = await tx.oferta.update({
        where: { id: oferta.id },
        data: {
          preco: precoNovo,
          precoAnterior: precoAnteriorNovo,
          ...(codigoMarketplace
            ? { codigoMarketplace }
            : {}),
          vendedorIdentificador,
          urlOriginal: urlFinal,
          status: statusNovo,
          verificadoEm: agora,
          coletadoEm: agora,
        },
        include: {
          produto: { select: { id: true, nome: true, slug: true } },
          parceiro: { select: { id: true, nome: true, slug: true } },
        },
      });

      if (mudouPreco) {
        await tx.historicoPrecoOferta.create({
          data: {
            ofertaId: oferta.id,
            preco: precoNovo,
            frete: oferta.frete,
            verificadoEm: agora,
          },
        });
      }
      return registro;
    });

    return {
      atualizado: true,
      fonte: item.fonte ?? 'MERCADO_LIVRE_API',
      apiOficial: item.apiOficial === true,
      fallbackUsado: item.fallbackUsado === true,
      oferta: atualizada,
      mercadoLivre: {
        itemId: codigoMarketplace ?? null,
        catalogProductId: item.catalogProductId ?? null,
        origemPreco: item.origemPreco ?? null,
        emPromocao: promocaoOficial !== null,
        descontoPercentual: item.descontoPercentual ?? null,
        disponivel: item.disponivel ?? null,
      },
      precoAnteriorBanco: precoBanco,
      precoAnteriorOficial: promocaoOficial,
      precoAtual: precoNovo,
      mudouPreco,
    };
  }

  async sincronizarOfertas(limiteInformado = 20) {
    const limite = Math.min(Math.max(limiteInformado, 1), 50);
    const candidatas = await this.prisma.oferta.findMany({
      where: {
        status: { in: [StatusOferta.ATIVA, StatusOferta.INDISPONIVEL] },
        parceiro: { ativo: true },
      },
      orderBy: [{ coletadoEm: 'asc' }, { id: 'asc' }],
      take: Math.min(limite * 6, 250),
      select: {
        id: true,
        codigoMarketplace: true,
        urlOriginal: true,
        urlAfiliada: true,
        parceiro: {
          select: { nome: true, slug: true, dominio: true },
        },
      },
    });

    const ofertas = candidatas
      .filter(
        (oferta) =>
          this.ehParceiroMercadoLivre(oferta.parceiro) ||
          this.ehMercadoLivreUrl(oferta.urlOriginal) ||
          this.ehMercadoLivreUrl(oferta.urlAfiliada),
      )
      .slice(0, limite);

    const resultados: Array<Record<string, unknown>> = [];
    for (const oferta of ofertas) {
      try {
        const resultado = await this.sincronizarOferta(oferta.id);
        resultados.push({
          ofertaId: oferta.id,
          atualizado: true,
          status:
            resultado.oferta.status === StatusOferta.INDISPONIVEL
              ? 'INDISPONIVEL'
              : resultado.mudouPreco
                ? 'ATUALIZADO'
                : 'SEM_ALTERACAO',
          precoAtual: resultado.precoAtual,
          precoAnteriorBanco: resultado.precoAnteriorBanco,
          mercadoLivre: resultado.mercadoLivre,
          apiOficial: resultado.apiOficial,
          fallbackUsado: resultado.fallbackUsado,
        });
      } catch (erro) {
        resultados.push({
          ofertaId: oferta.id,
          atualizado: false,
          status: 'ERRO',
          motivo:
            erro instanceof Error
              ? erro.message
              : 'Falha ao sincronizar oferta Mercado Livre.',
        });
      }
    }

    return {
      fonte: 'MERCADO_LIVRE_API',
      apiOficial: true,
      totalProcessado: resultados.length,
      resultados,
    };
  }
}
