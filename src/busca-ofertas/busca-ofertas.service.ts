import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StatusOferta } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificadorOfertasService } from './classificador-ofertas.service';
import {
  FiltrarBuscaOfertasDto,
  OrdenacaoBuscaOferta,
  TagBuscaOferta,
} from './dtos/filtrar-busca-ofertas.dto';
import { ShopeeProjetoIaService } from './shopee-projeto-ia.service';
import { MercadoLivreProjetoIaService } from './mercadolivre-projeto-ia.service';
import { postProdutoIa } from '../ia/produto-ia-http';

type OfertaBuscaInterna = {
  id: number;
  produtoId: number;
  nome: string;
  descricao: string;
  tag: TagBuscaOferta;
  precoAtual: number;
  precoAnterior: number | null;
  descontoPercentual: number | null;
  url: string;
  imagemUrl: string | null;
  produtoPublicado: boolean;
  parceiro: {
    id: number;
    nome: string;
    slug: string;
  };
  atualizadoEm: string;
};

@Injectable()
export class BuscaOfertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classificadorOfertasService: ClassificadorOfertasService,
    private readonly shopeeProjetoIa: ShopeeProjetoIaService,
    private readonly mercadoLivreProjetoIa: MercadoLivreProjetoIaService,
  ) {}

  private calcularDesconto(
    precoAtual: number,
    precoAnterior: number | null,
  ): number | null {
    if (
      precoAnterior === null ||
      precoAnterior <= 0 ||
      precoAnterior <= precoAtual
    ) {
      return null;
    }

    return Number(
      (((precoAnterior - precoAtual) / precoAnterior) * 100).toFixed(2),
    );
  }

  private classificarProduto(
    nome: string,
    categoriaNome: string,
    categoriaSlug: string,
  ): TagBuscaOferta {
    const slug = categoriaSlug.toLowerCase();

    if (slug.includes('placa') && slug.includes('video')) {
      return TagBuscaOferta.PLACA_VIDEO;
    }
    if (slug.includes('processador')) return TagBuscaOferta.PROCESSADOR;
    if (slug.includes('placa') && slug.includes('mae')) {
      return TagBuscaOferta.PLACA_MAE;
    }
    if (slug.includes('memoria') && slug.includes('ram')) {
      return TagBuscaOferta.MEMORIA_RAM;
    }
    if (
      slug.includes('ssd') ||
      slug.includes('armazenamento') ||
      slug.includes('storage')
    ) {
      return TagBuscaOferta.SSD;
    }
    if (slug.includes('fonte')) return TagBuscaOferta.FONTE;
    if (slug.includes('gabinete')) return TagBuscaOferta.GABINETE;
    if (slug.includes('monitor')) return TagBuscaOferta.MONITOR;
    if (slug.includes('notebook')) return TagBuscaOferta.NOTEBOOK;
    if (
      slug.includes('celular') ||
      slug.includes('smartphone') ||
      slug.includes('mobile')
    ) {
      return TagBuscaOferta.CELULAR;
    }
    if (
      ['mouse', 'teclado', 'headset', 'fone', 'microfone', 'webcam'].some(
        (termo) => slug.includes(termo),
      )
    ) {
      return TagBuscaOferta.PERIFERICOS;
    }

    return this.classificadorOfertasService.classificar(
      nome,
      `${categoriaNome} ${categoriaSlug}`,
    );
  }

  private async carregarOfertas(): Promise<OfertaBuscaInterna[]> {
    const agora = new Date();
    const ofertas = await this.prisma.oferta.findMany({
      where: {
        status: StatusOferta.ATIVA,
        urlAfiliada: { not: null },
        produto: { ativo: true },
        parceiro: { ativo: true },
        OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
      },
      orderBy: [{ atualizadoEm: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        preco: true,
        precoAnterior: true,
        urlAfiliada: true,
        atualizadoEm: true,
        produto: {
          select: {
            id: true,
            nome: true,
            descricao: true,
            marca: true,
            modelo: true,
            imagemUrl: true,
            publicado: true,
            categoria: {
              select: {
                nome: true,
                slug: true,
              },
            },
          },
        },
        parceiro: {
          select: {
            id: true,
            nome: true,
            slug: true,
          },
        },
      },
    });

    return ofertas.flatMap((oferta) => {
      const url = oferta.urlAfiliada?.trim();
      if (!url) return [];

      const precoAtual = Number(oferta.preco);
      const precoAnterior =
        oferta.precoAnterior === null ? null : Number(oferta.precoAnterior);
      const descricao =
        oferta.produto.descricao?.trim() ||
        [oferta.produto.marca, oferta.produto.modelo]
          .filter(Boolean)
          .join(' ') ||
        oferta.produto.nome;

      return [
        {
          id: oferta.id,
          produtoId: oferta.produto.id,
          nome: oferta.produto.nome,
          descricao,
          tag: this.classificarProduto(
            oferta.produto.nome,
            oferta.produto.categoria.nome,
            oferta.produto.categoria.slug,
          ),
          precoAtual,
          precoAnterior,
          descontoPercentual: this.calcularDesconto(precoAtual, precoAnterior),
          url,
          imagemUrl: oferta.produto.imagemUrl,
          produtoPublicado: oferta.produto.publicado,
          parceiro: oferta.parceiro,
          atualizadoEm: oferta.atualizadoEm.toISOString(),
        },
      ];
    });
  }

  private aplicarFiltros(
    ofertasOriginais: OfertaBuscaInterna[],
    filtros: FiltrarBuscaOfertasDto,
  ): OfertaBuscaInterna[] {
    const busca = filtros.busca?.trim().toLowerCase();
    const tag = filtros.tag ?? filtros.categoria;

    let ofertas = ofertasOriginais.filter((oferta) => {
      if (busca) {
        const alvo =
          `${oferta.nome} ${oferta.descricao} ${oferta.parceiro.nome}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      if (tag && oferta.tag !== tag) return false;
      if (
        filtros.descontoMinimo !== undefined &&
        (oferta.descontoPercentual === null ||
          oferta.descontoPercentual < filtros.descontoMinimo)
      ) {
        return false;
      }
      return true;
    });

    const ordenar = filtros.ordenar ?? OrdenacaoBuscaOferta.MAIOR_DESCONTO;
    ofertas = [...ofertas].sort((a, b) => {
      switch (ordenar) {
        case OrdenacaoBuscaOferta.MENOR_PRECO:
          return a.precoAtual - b.precoAtual;
        case OrdenacaoBuscaOferta.MAIOR_PRECO:
          return b.precoAtual - a.precoAtual;
        case OrdenacaoBuscaOferta.MAIS_RECENTES:
          return b.atualizadoEm.localeCompare(a.atualizadoEm);
        case OrdenacaoBuscaOferta.MAIOR_DESCONTO:
        default:
          return (b.descontoPercentual ?? -1) - (a.descontoPercentual ?? -1);
      }
    });

    return ofertas;
  }

  async listar(filtros: FiltrarBuscaOfertasDto) {
    const todas = await this.carregarOfertas();
    const ofertas = this.aplicarFiltros(todas, filtros);

    return {
      total: ofertas.length,
      ultimaAtualizacao: todas[0]?.atualizadoEm ?? null,
      origem: 'BANCO_CRIABYTE' as const,
      modo: 'PRODUTOS_COM_LINK_AFILIADO' as const,
      ofertas,
    };
  }

  async atualizar(filtros: FiltrarBuscaOfertasDto) {
    const projetoIaConfigurado = Boolean(
      process.env.PRODUTO_IA_URL?.trim() && process.env.PRODUTO_IA_API_KEY?.trim(),
    );

    let sincronizacaoShopee: Awaited<
      ReturnType<ShopeeProjetoIaService['sincronizarOfertas']>
    > | null = null;
    let sincronizacaoMercadoLivre: Awaited<
      ReturnType<MercadoLivreProjetoIaService['sincronizarOfertas']>
    > | null = null;

    if (projetoIaConfigurado) {
      [sincronizacaoShopee, sincronizacaoMercadoLivre] = await Promise.all([
        this.shopeeProjetoIa.sincronizarOfertas(20),
        this.mercadoLivreProjetoIa.sincronizarOfertas(20),
      ]);
    }

    return {
      ...(await this.listar(filtros)),
      atualizacaoExecutada: true,
      integracoes: {
        shopee: sincronizacaoShopee ?? {
          fonte: 'SHOPEE_AFFILIATE_API',
          apiOficial: true,
          configurada: false,
          totalProcessado: 0,
          resultados: [],
        },
        mercadoLivre: sincronizacaoMercadoLivre ?? {
          fonte: 'MERCADO_LIVRE_API',
          apiOficial: true,
          configurada: false,
          totalProcessado: 0,
          resultados: [],
        },
      },
      observacao: projetoIaConfigurado
        ? 'Ofertas Shopee e Mercado Livre foram sincronizadas via APIs oficiais pelo ProjetoIA antes de reler o banco.'
        : 'ProjetoIA não configurado; a lista foi relida do banco sem sincronização externa.',
    };
  }

  private produtoIaConfig() {
    const baseUrl = process.env.PRODUTO_IA_URL?.trim().replace(/\/+$/, '');
    const apiKey = process.env.PRODUTO_IA_API_KEY?.trim();
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException(
        'ProjetoIA não configurado para buscar o mesmo Produto em outras lojas.',
      );
    }
    return { baseUrl, apiKey };
  }

  private async buscarOfertasIdenticasProjetoIa(produto: {
    nome: string;
    marca: string | null;
    modelo: string | null;
    mpn: string | null;
    gtin: string | null;
  }) {
    const { baseUrl, apiKey } = this.produtoIaConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await postProdutoIa(`${baseUrl}/ofertas/produto-identico`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          nome: produto.nome,
          marca: produto.marca,
          modelo: produto.modelo,
          mpn: produto.mpn,
          gtin: produto.gtin,
          limitePorLoja: 3,
        }),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        let message = 'Não foi possível procurar o Produto em outras lojas.';
        try {
          const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
          if (typeof parsed.detail === 'string') message = parsed.detail;
          else if (typeof parsed.message === 'string') message = parsed.message;
        } catch {
          if (text.trim()) message = text.slice(0, 500);
        }
        throw new BadGatewayException(message);
      }
      try {
        return JSON.parse(text) as {
          quantidade?: number;
          ofertas?: Array<{
            parceiro?: string;
            marketplace?: string;
            criterioIdentidade?: string;
            nomeEncontrado?: string | null;
            preco?: number | null;
            precoAnterior?: number | null;
            urlOriginal?: string | null;
            urlAfiliada?: string | null;
            codigoMarketplace?: string | null;
            vendedorNome?: string | null;
            vendedorIdentificador?: string | null;
            apiOficial?: boolean;
            fonte?: string | null;
          }>;
          fontes?: Record<string, unknown>;
        };
      } catch {
        throw new BadGatewayException(
          'ProjetoIA retornou uma resposta inválida ao procurar ofertas idênticas.',
        );
      }
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadGatewayException(
          'A busca nas outras lojas excedeu o tempo limite.',
        );
      }
      throw new BadGatewayException(
        `Falha ao consultar o ProjetoIA: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private parceiroConhecido(marketplace: string | undefined) {
    switch (String(marketplace || '').toUpperCase()) {
      case 'MERCADO_LIVRE':
        return {
          nome: 'Mercado Livre',
          slug: 'mercado-livre',
          dominio: 'mercadolivre.com.br',
          site: 'https://www.mercadolivre.com.br',
        };
      case 'MAGALU':
        return {
          nome: 'Magazine Luiza',
          slug: 'magazine-luiza',
          dominio: 'magazineluiza.com.br',
          site: 'https://www.magazineluiza.com.br',
        };
      case 'SHOPEE':
        return {
          nome: 'Shopee',
          slug: 'shopee',
          dominio: 'shopee.com.br',
          site: 'https://shopee.com.br',
        };
      case 'AMAZON':
        return {
          nome: 'Amazon',
          slug: 'amazon',
          dominio: 'amazon.com.br',
          site: 'https://www.amazon.com.br',
        };
      case 'KABUM':
        return {
          nome: 'KaBuM!',
          slug: 'kabum',
          dominio: 'kabum.com.br',
          site: 'https://www.kabum.com.br',
        };
      case 'PICHAU':
        return {
          nome: 'Pichau',
          slug: 'pichau',
          dominio: 'pichau.com.br',
          site: 'https://www.pichau.com.br',
        };
      case 'TERABYTE':
        return {
          nome: 'Terabyte',
          slug: 'terabyte',
          dominio: 'terabyteshop.com.br',
          site: 'https://www.terabyteshop.com.br',
        };
      case 'ALIEXPRESS':
        return {
          nome: 'AliExpress',
          slug: 'aliexpress',
          dominio: 'aliexpress.com',
          site: 'https://www.aliexpress.com',
        };
      default:
        return null;
    }
  }

  private async obterOuCriarParceiro(marketplace: string | undefined) {
    const conhecido = this.parceiroConhecido(marketplace);
    if (!conhecido) return null;

    const existente = await this.prisma.parceiro.findFirst({
      where: {
        OR: [
          { slug: conhecido.slug },
          { dominio: conhecido.dominio },
          { nome: { equals: conhecido.nome, mode: 'insensitive' } },
        ],
      },
      select: { id: true, ativo: true },
    });
    if (existente) {
      if (!existente.ativo) {
        await this.prisma.parceiro.update({
          where: { id: existente.id },
          data: { ativo: true },
        });
      }
      return existente.id;
    }

    const criado = await this.prisma.parceiro.create({
      data: {
        nome: conhecido.nome,
        slug: conhecido.slug,
        dominio: conhecido.dominio,
        site: conhecido.site,
        programaAfiliados: true,
        ativo: true,
      },
      select: { id: true },
    });
    return criado.id;
  }

  async encontrarECadastrarOfertasIdenticas(produtoId: number) {
    const produto = await this.prisma.produto.findFirst({
      where: { id: produtoId, ativo: true },
      select: {
        id: true,
        nome: true,
        marca: true,
        modelo: true,
        mpn: true,
        gtin: true,
        hardware: { select: { id: true } },
      },
    });
    if (!produto) {
      throw new NotFoundException('Produto não encontrado ou inativo.');
    }

    const resultado = await this.buscarOfertasIdenticasProjetoIa(produto);
    const encontradas = Array.isArray(resultado.ofertas) ? resultado.ofertas : [];
    const cadastradas: Array<Record<string, unknown>> = [];
    const ignoradas: Array<Record<string, unknown>> = [];

    for (const candidata of encontradas) {
      const urlOriginal = String(candidata.urlOriginal || '').trim();
      const preco = Number(candidata.preco);
      const parceiroId = await this.obterOuCriarParceiro(candidata.marketplace);

      if (!parceiroId || !urlOriginal || !Number.isFinite(preco) || preco <= 0) {
        ignoradas.push({
          marketplace: candidata.marketplace ?? null,
          urlOriginal: urlOriginal || null,
          motivo: 'DADOS_INCOMPLETOS',
        });
        continue;
      }

      const existente = await this.prisma.oferta.findFirst({
        where: {
          produtoId: produto.id,
          parceiroId,
          OR: [
            { urlOriginal },
            ...(candidata.codigoMarketplace
              ? [{ codigoMarketplace: String(candidata.codigoMarketplace) }]
              : []),
          ],
        },
        select: { id: true },
      });
      if (existente) {
        ignoradas.push({
          marketplace: candidata.marketplace,
          urlOriginal,
          ofertaId: existente.id,
          motivo: 'JA_CADASTRADA',
        });
        continue;
      }

      const agora = new Date();
      const oferta = await this.prisma.oferta.create({
        data: {
          produtoId: produto.id,
          hardwareId: produto.hardware?.id ?? null,
          parceiroId,
          vendedorNome: String(candidata.vendedorNome || '').trim() || null,
          vendedorIdentificador:
            String(candidata.vendedorIdentificador || '').trim() || null,
          codigoMarketplace:
            String(candidata.codigoMarketplace || '').trim() || null,
          urlOriginal,
          urlAfiliada: String(candidata.urlAfiliada || '').trim() || null,
          preco: Number(preco.toFixed(2)),
          precoAnterior:
            candidata.precoAnterior !== null &&
            candidata.precoAnterior !== undefined &&
            Number.isFinite(Number(candidata.precoAnterior)) &&
            Number(candidata.precoAnterior) > 0
              ? Number(Number(candidata.precoAnterior).toFixed(2))
              : null,
          status: StatusOferta.ATIVA,
          verificadoEm: agora,
          coletadoEm: agora,
          historicoPrecos: {
            create: {
              preco: Number(preco.toFixed(2)),
              verificadoEm: agora,
            },
          },
        },
        include: {
          parceiro: { select: { id: true, nome: true, slug: true } },
        },
      });

      cadastradas.push({
        id: oferta.id,
        parceiro: oferta.parceiro,
        preco: Number(oferta.preco),
        urlOriginal: oferta.urlOriginal,
        urlAfiliada: oferta.urlAfiliada,
        criterioIdentidade: candidata.criterioIdentidade ?? null,
        fonte: candidata.fonte ?? null,
      });
    }

    return {
      produto: {
        id: produto.id,
        nome: produto.nome,
        marca: produto.marca,
        modelo: produto.modelo,
        mpn: produto.mpn,
        gtin: produto.gtin,
      },
      quantidadeEncontrada: encontradas.length,
      quantidadeCadastrada: cadastradas.length,
      quantidadeIgnorada: ignoradas.length,
      cadastradas,
      ignoradas,
      fontes: resultado.fontes ?? {},
      produtoAlterado: false,
      fichaTecnicaAlterada: false,
    };
  }

  async status() {
    const agora = new Date();
    const total = await this.prisma.oferta.count({
      where: {
        status: StatusOferta.ATIVA,
        urlAfiliada: { not: null },
        produto: { ativo: true },
        parceiro: { ativo: true },
        OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
      },
    });
    const projetoIaConfigurado = Boolean(
      process.env.PRODUTO_IA_URL?.trim() && process.env.PRODUTO_IA_API_KEY?.trim(),
    );

    return {
      origem: 'BANCO_CRIABYTE' as const,
      apiExterna: projetoIaConfigurado,
      modo: 'PRODUTOS_COM_LINK_AFILIADO' as const,
      totalComLinkAfiliado: total,
      integracoes: {
        shopee: {
          habilitada: projetoIaConfigurado,
          fonte: 'SHOPEE_AFFILIATE_API' as const,
          via: 'PROJETO_IA' as const,
          credencialShopeeNoBackend: false,
        },
        mercadoLivre: {
          habilitada: projetoIaConfigurado,
          fonte: 'MERCADO_LIVRE_API' as const,
          via: 'PROJETO_IA' as const,
          credencialMercadoLivreNoBackend: false,
          apiPrimeiro: true,
          scrapingSomenteFallback: true,
        },
      },
      regras: {
        criaHardwareAutomaticamente: false,
        criaProdutoAutomaticamente: false,
        criaOfertaAutomaticamente: false,
        apareceQuando:
          'O Produto possui uma Oferta ativa, válida e com urlAfiliada preenchida.',
      },
    };
  }
}
