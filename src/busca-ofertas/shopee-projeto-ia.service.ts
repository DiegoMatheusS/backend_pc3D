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
import {
  BuscarProdutosShopeeDto,
  BuscarPromocoesShopeeDto,
  GerarLinkShopeeDto,
} from './dtos/buscar-shopee.dto';

export type ProdutoShopeeProjetoIa = {
  fonte?: string;
  marketplace?: string;
  itemId?: string | null;
  shopId?: string | null;
  nome?: string | null;
  loja?: string | null;
  urlOriginal?: string | null;
  urlAfiliada?: string | null;
  imagemUrl?: string | null;
  preco?: number | null;
  precoMin?: number | null;
  precoMax?: number | null;
  descontoPercentual?: number | null;
  emPromocao?: boolean;
  vendas?: number | null;
  avaliacao?: number | null;
  comissaoPercentual?: number | null;
  promocaoInicio?: number | null;
  promocaoFim?: number | null;
  apiOficial?: boolean;
  relevanciaAgente?: number;
  ordemAgente?: number;
};

type RespostaProdutosShopee = {
  agente?: string;
  modo?: string;
  consulta?: string | null;
  itemId?: string | null;
  shopId?: string | null;
  quantidade?: number;
  itens?: ProdutoShopeeProjetoIa[];
  pagina?: Record<string, unknown>;
  fontePrimaria?: string;
  scrapingNecessario?: boolean;
};

type RespostaPromocoesShopee = {
  agente?: string;
  modo?: string;
  consulta?: string | null;
  quantidade?: number;
  itens?: Array<Record<string, unknown>>;
  pagina?: Record<string, unknown>;
  fontePrimaria?: string;
  scrapingNecessario?: boolean;
};

@Injectable()
export class ShopeeProjetoIaService {
  private readonly logger = new Logger(ShopeeProjetoIaService.name);

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
      const detail = registro.detail;
      if (typeof detail === 'string' && detail.trim()) return detail.trim();
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
    const timeoutConfigurado = Number(process.env.PRODUTO_IA_SHOPEE_TIMEOUT_MS ?? 30_000);
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
            mensagem ?? 'A Shopee Affiliate API ainda não está configurada no ProjetoIA.',
          );
        }
        if (resposta.status === 400 || resposta.status === 422) {
          throw new BadRequestException(mensagem ?? 'Consulta Shopee inválida.');
        }
        this.logger.error(
          `ProjetoIA Shopee HTTP ${resposta.status}: ${texto.slice(0, 1000)}`,
        );
        throw new BadGatewayException(
          mensagem ?? `ProjetoIA respondeu HTTP ${resposta.status} ao consultar a Shopee.`,
        );
      }

      try {
        return JSON.parse(texto) as T;
      } catch {
        throw new BadGatewayException('ProjetoIA retornou JSON inválido para a consulta Shopee.');
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
        throw new BadGatewayException('Tempo limite excedido ao consultar a Shopee pelo ProjetoIA.');
      }
      throw new BadGatewayException(
        `Falha ao consultar a Shopee pelo ProjetoIA: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async buscarProdutos(dados: BuscarProdutosShopeeDto): Promise<RespostaProdutosShopee> {
    const consulta = dados.consulta?.trim() || undefined;
    const itemId = dados.itemId?.trim() || undefined;
    if (!consulta && !itemId) {
      throw new BadRequestException('Informe consulta ou itemId da Shopee.');
    }

    return this.post<RespostaProdutosShopee>('/shopee/agente/produtos', {
      ...(consulta ? { consulta } : {}),
      ...(itemId ? { itemId } : {}),
      ...(dados.shopId?.trim() ? { shopId: dados.shopId.trim() } : {}),
      limite: dados.limite ?? 20,
      somentePromocoes: dados.somentePromocoes ?? false,
    });
  }

  buscarPromocoes(dados: BuscarPromocoesShopeeDto): Promise<RespostaPromocoesShopee> {
    return this.post<RespostaPromocoesShopee>('/shopee/agente/promocoes', {
      ...(dados.consulta?.trim() ? { consulta: dados.consulta.trim() } : {}),
      limite: dados.limite ?? 20,
    });
  }

  gerarLinkAfiliado(dados: GerarLinkShopeeDto) {
    return this.post<{
      urlOriginal: string;
      urlAfiliada: string;
      fonte: string;
      apiOficial: boolean;
    }>('/shopee/link-afiliado', {
      url: dados.url,
      subIds: (dados.subIds ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 5),
    });
  }

  private ehParceiroShopee(parceiro: { nome: string; slug: string; dominio: string | null }): boolean {
    return [parceiro.nome, parceiro.slug, parceiro.dominio]
      .filter((valor): valor is string => Boolean(valor))
      .some((valor) => valor.toLowerCase().includes('shopee'));
  }

  private extrairIdsShopee(dados: {
    codigoMarketplace: string | null;
    urlOriginal: string;
    urlAfiliada: string | null;
  }): { itemId: string | null; shopId: string | null } {
    const codigo = dados.codigoMarketplace?.trim() ?? '';
    if (/^\d+$/u.test(codigo)) {
      return { itemId: codigo, shopId: null };
    }
    const codigoComLoja = /^(\d+)[.:/_-](\d+)$/u.exec(codigo);
    if (codigoComLoja) {
      return { shopId: codigoComLoja[1], itemId: codigoComLoja[2] };
    }

    for (const valor of [dados.urlOriginal, dados.urlAfiliada]) {
      if (!valor) continue;
      let url: URL;
      try {
        url = new URL(valor);
      } catch {
        continue;
      }
      if (!url.hostname.toLowerCase().includes('shopee.')) continue;

      const caminho = decodeURIComponent(url.pathname);
      const product = /\/product\/(\d+)\/(\d+)/iu.exec(caminho);
      if (product) return { shopId: product[1], itemId: product[2] };

      const slug = /(?:^|[-/.])i\.(\d+)\.(\d+)(?:$|[/?#-])/iu.exec(caminho);
      if (slug) return { shopId: slug[1], itemId: slug[2] };

      const itemId = url.searchParams.get('itemid') ?? url.searchParams.get('itemId');
      const shopId = url.searchParams.get('shopid') ?? url.searchParams.get('shopId');
      if (itemId && /^\d+$/u.test(itemId)) {
        return {
          itemId,
          shopId: shopId && /^\d+$/u.test(shopId) ? shopId : null,
        };
      }
    }

    return { itemId: null, shopId: null };
  }

  private precoValido(valor: unknown): number | null {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0 ? Number(numero.toFixed(2)) : null;
  }

  async sincronizarOferta(ofertaId: number) {
    const oferta = await this.prisma.oferta.findUnique({
      where: { id: ofertaId },
      select: {
        id: true,
        preco: true,
        precoAnterior: true,
        frete: true,
        codigoMarketplace: true,
        urlOriginal: true,
        urlAfiliada: true,
        vendedorNome: true,
        vendedorIdentificador: true,
        produto: { select: { id: true, nome: true } },
        parceiro: { select: { id: true, nome: true, slug: true, dominio: true } },
      },
    });
    if (!oferta) throw new NotFoundException('Oferta não encontrada.');
    if (!this.ehParceiroShopee(oferta.parceiro)) {
      throw new BadRequestException('Esta oferta não pertence a um parceiro Shopee.');
    }

    const ids = this.extrairIdsShopee(oferta);
    if (!ids.itemId) {
      throw new BadRequestException(
        'Não foi possível identificar o itemId da Shopee nesta oferta. Salve o código do marketplace ou uma URL completa do item antes de sincronizar.',
      );
    }

    const resposta = await this.buscarProdutos({
      itemId: ids.itemId,
      ...(ids.shopId ? { shopId: ids.shopId } : {}),
      limite: 5,
    });
    const item = (resposta.itens ?? []).find(
      (candidato) => String(candidato.itemId ?? '') === ids.itemId,
    );
    if (!item) {
      throw new BadGatewayException(
        'A Shopee Affiliate API não retornou o item cadastrado. O preço salvo foi preservado.',
      );
    }

    const precoNovo = this.precoValido(item.preco ?? item.precoMin);
    if (precoNovo === null) {
      throw new BadGatewayException(
        'A Shopee Affiliate API não retornou um preço válido. O preço salvo foi preservado.',
      );
    }

    const precoAtual = Number(oferta.preco);
    const mudouPreco = Math.abs(precoAtual - precoNovo) >= 0.01;
    const agora = new Date();
    const urlOriginal = item.urlOriginal?.trim() || oferta.urlOriginal;
    const urlAfiliada = item.urlAfiliada?.trim() || oferta.urlAfiliada;

    const atualizada = await this.prisma.oferta.update({
      where: { id: oferta.id },
      data: {
        preco: precoNovo,
        ...(mudouPreco ? { precoAnterior: precoAtual } : {}),
        codigoMarketplace: String(item.itemId ?? ids.itemId),
        vendedorNome: item.loja?.trim() || oferta.vendedorNome,
        vendedorIdentificador: String(item.shopId ?? ids.shopId ?? '').trim() || oferta.vendedorIdentificador,
        urlOriginal,
        urlAfiliada,
        status: StatusOferta.ATIVA,
        verificadoEm: agora,
        coletadoEm: agora,
        historicoPrecos: {
          create: {
            preco: precoNovo,
            frete: oferta.frete,
            verificadoEm: agora,
          },
        },
      },
      include: {
        produto: { select: { id: true, nome: true, slug: true } },
        parceiro: { select: { id: true, nome: true, slug: true } },
      },
    });

    return {
      atualizado: true,
      fonte: 'SHOPEE_AFFILIATE_API',
      apiOficial: true,
      oferta: atualizada,
      shopee: {
        itemId: item.itemId ?? ids.itemId,
        shopId: item.shopId ?? ids.shopId,
        emPromocao: item.emPromocao === true,
        descontoPercentual: item.descontoPercentual ?? null,
        vendas: item.vendas ?? null,
        avaliacao: item.avaliacao ?? null,
        comissaoPercentual: item.comissaoPercentual ?? null,
      },
      precoAnteriorBanco: precoAtual,
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
      take: Math.min(limite * 5, 200),
      select: {
        id: true,
        codigoMarketplace: true,
        urlOriginal: true,
        urlAfiliada: true,
        parceiro: { select: { nome: true, slug: true, dominio: true } },
      },
    });

    const ofertas = candidatas
      .filter((oferta) => this.ehParceiroShopee(oferta.parceiro))
      .slice(0, limite);
    const resultados: Array<Record<string, unknown>> = [];

    for (const oferta of ofertas) {
      const ids = this.extrairIdsShopee(oferta);
      if (!ids.itemId) {
        resultados.push({
          ofertaId: oferta.id,
          atualizado: false,
          status: 'REVISAR',
          motivo: 'itemId da Shopee não identificado.',
        });
        continue;
      }
      try {
        const resultado = await this.sincronizarOferta(oferta.id);
        resultados.push({
          ofertaId: oferta.id,
          atualizado: true,
          status: resultado.mudouPreco ? 'ATUALIZADO' : 'SEM_ALTERACAO',
          precoAtual: resultado.precoAtual,
          precoAnteriorBanco: resultado.precoAnteriorBanco,
          shopee: resultado.shopee,
        });
      } catch (erro) {
        resultados.push({
          ofertaId: oferta.id,
          atualizado: false,
          status: 'ERRO',
          motivo: erro instanceof Error ? erro.message : 'Falha ao sincronizar oferta Shopee.',
        });
      }
    }

    return {
      fonte: 'SHOPEE_AFFILIATE_API',
      apiOficial: true,
      totalProcessado: resultados.length,
      resultados,
    };
  }
}
