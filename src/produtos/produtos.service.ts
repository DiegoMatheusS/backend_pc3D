import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  OrigemDadoProduto,
  StatusAvaliacao,
  StatusImportacao,
  StatusOferta,
  TipoProduto,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarCategoriaProdutoDto } from './dtos/atualizar-categoria-produto.dto';
import { AtualizarProdutoDto } from './dtos/atualizar-produto.dto';
import { CriarCategoriaProdutoDto } from './dtos/criar-categoria-produto.dto';
import { CriarProdutoDto } from './dtos/criar-produto.dto';
import { FiltrarProdutosDto } from './dtos/filtrar-produtos.dto';
import { RevisarImportacaoProdutoDto } from './dtos/revisar-importacao-produto.dto';
import { normalizarEspecificacoesHardwarePublicas } from './normalizar-especificacoes-hardware';

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  private criarSlug(texto: string): string {
    const slug = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || 'produto';
  }

  private async criarSlugUnico(texto: string, ignorarId?: number) {
    const base = this.criarSlug(texto);
    let slug = base;
    let indice = 2;

    while (true) {
      const existente = await this.prisma.produto.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existente || existente.id === ignorarId) return slug;
      slug = `${base}-${indice++}`;
    }
  }

  private enderecoIpPrivado(endereco: string): boolean {
    const ip = endereco.replace(/^\[|\]$/g, '').toLowerCase();
    const versao = isIP(ip);

    if (versao === 4) {
      const partes = ip.split('.').map(Number);
      const [a, b] = partes;
      return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a >= 224
      );
    }

    if (versao === 6) {
      if (
        ip === '::' ||
        ip === '::1' ||
        ip.startsWith('fc') ||
        ip.startsWith('fd') ||
        /^fe[89ab]/.test(ip) ||
        ip.startsWith('ff')
      ) {
        return true;
      }
      if (ip.startsWith('::ffff:')) {
        return this.enderecoIpPrivado(ip.slice('::ffff:'.length));
      }
    }

    return false;
  }

  private async validarUrlPublica(valor: string): Promise<URL> {
    let url: URL;
    try {
      url = new URL(valor);
    } catch {
      throw new BadRequestException('A URL informada é inválida.');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('A importação aceita apenas HTTP/HTTPS.');
    }
    if (url.username || url.password) {
      throw new BadRequestException('URLs com credenciais não são permitidas.');
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      this.enderecoIpPrivado(hostname)
    ) {
      throw new BadRequestException(
        'O endereço informado não pode apontar para uma rede interna.',
      );
    }

    try {
      const enderecos = await lookup(hostname, { all: true, verbatim: true });
      if (
        enderecos.length === 0 ||
        enderecos.some(({ address }) => this.enderecoIpPrivado(address))
      ) {
        throw new BadRequestException(
          'O endereço informado não pode apontar para uma rede interna.',
        );
      }
    } catch (erro) {
      if (erro instanceof BadRequestException) throw erro;
      throw new BadRequestException(
        'Não foi possível resolver o endereço informado.',
      );
    }

    return url;
  }

  private async lerHtmlLimitado(
    resposta: Response,
    limiteBytes = 2_000_000,
  ): Promise<string> {
    const tamanhoInformado = Number(
      resposta.headers.get('content-length') ?? '0',
    );

    if (tamanhoInformado > limiteBytes) {
      throw new BadRequestException(
        'A página é grande demais para importação.',
      );
    }

    if (!resposta.body) return '';

    const leitor = resposta.body.getReader();
    const decoder = new TextDecoder();
    let totalBytes = 0;
    let html = '';

    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > limiteBytes) {
        await leitor.cancel();
        throw new BadRequestException(
          'A página é grande demais para importação.',
        );
      }

      html += decoder.decode(value, { stream: true });
    }

    html += decoder.decode();
    return html;
  }

  private extrairMeta(html: string, propriedade: string): string | null {
    const escaped = propriedade.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expressoes = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        'i',
      ),
    ];

    for (const expressao of expressoes) {
      const encontrado = expressao.exec(html)?.[1]?.trim();
      if (encontrado) return encontrado;
    }
    return null;
  }

  private extrairJsonLdProduto(html: string): Record<string, unknown> | null {
    const regex =
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const correspondencia of html.matchAll(regex)) {
      try {
        const bruto = correspondencia[1]?.trim();
        if (!bruto) continue;
        const parsed: unknown = JSON.parse(bruto);
        const candidatos = Array.isArray(parsed) ? parsed : [parsed];

        for (const candidato of candidatos) {
          if (!candidato || typeof candidato !== 'object') continue;
          const registro = candidato as Record<string, unknown>;
          const tipo = registro['@type'];
          if (
            tipo === 'Product' ||
            (Array.isArray(tipo) && tipo.includes('Product'))
          ) {
            return registro;
          }
          const graph = registro['@graph'];
          if (Array.isArray(graph)) {
            const itensGraph: unknown[] = graph;
            const produto = itensGraph.find((item) => {
              if (!item || typeof item !== 'object') return false;
              const t = (item as Record<string, unknown>)['@type'];
              return (
                t === 'Product' || (Array.isArray(t) && t.includes('Product'))
              );
            });
            if (produto && typeof produto === 'object') {
              return produto as Record<string, unknown>;
            }
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private normalizarTexto(valor: unknown): string | null {
    return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
  }

  private categoriaExigeCadastroEspecializado(categoriaSlug: string): boolean {
    return new Set([
      'pcs-montados',
      'notebooks',
      'processadores',
      'coolers',
      'placas-mae',
      'memorias-ram',
      'placas-video',
      'armazenamento',
      'fontes',
      'gabinetes',
      'ventoinhas',
    ]).has(categoriaSlug);
  }

  private validarCategoriaProdutoGenerico(categoriaSlug: string): void {
    if (this.categoriaExigeCadastroEspecializado(categoriaSlug)) {
      throw new BadRequestException(
        'Esta categoria possui cadastro técnico especializado. Use a rota administrativa de Hardware, Notebook ou PC Montado.',
      );
    }
  }

  private validarEspecificacaoUnica(
    dados: CriarProdutoDto | AtualizarProdutoDto,
  ) {
    const quantidade = [
      dados.especificacaoMonitor,
      dados.especificacaoMouse,
      dados.especificacaoTeclado,
      dados.especificacaoHeadset,
    ].filter(Boolean).length;

    if (quantidade > 1) {
      throw new BadRequestException(
        'Informe somente uma especificação específica por produto.',
      );
    }
  }

  private validarEspecificacaoDaCategoria(
    dados: CriarProdutoDto | AtualizarProdutoDto,
    categoriaSlug: string,
  ) {
    const regras = [
      { presente: dados.especificacaoMonitor !== undefined, slug: 'monitores' },
      { presente: dados.especificacaoMouse !== undefined, slug: 'mouses' },
      { presente: dados.especificacaoTeclado !== undefined, slug: 'teclados' },
      { presente: dados.especificacaoHeadset !== undefined, slug: 'headsets' },
    ];

    const informada = regras.find((regra) => regra.presente);
    if (informada && informada.slug !== categoriaSlug) {
      throw new BadRequestException(
        `A especificação informada pertence à categoria ${informada.slug}, mas o produto está em ${categoriaSlug}.`,
      );
    }
  }

  private includeProdutoDetalhado() {
    const agora = new Date();
    return {
      categoria: true,
      hardware: {
        include: {
          especificacaoProcessador: true,
          especificacaoPlacaMae: { include: { slotsM2: true } },
          especificacaoMemoriaRam: true,
          especificacaoGabinete: {
            include: { suportesFans: true, suportesRadiador: true },
          },
          especificacaoFonte: true,
          especificacaoPlacaVideo: true,
          especificacaoCooler: true,
          especificacaoVentoinha: true,
          especificacaoArmazenamento: true,
          modelos3D: {
            where: { ativo: true, aprovado: true },
            orderBy: [
              { atualizadoEm: 'desc' as const },
              { id: 'desc' as const },
            ],
            take: 1,
            select: {
              id: true,
              arquivoUrl: true,
              formato: true,
              origem: true,
              storageKey: true,
              fonteUrl: true,
              autor: true,
              licenca: true,
              versao: true,
              tamanhoBytes: true,
            },
          },
        },
      },
      notebook: {
        include: { especificacao: true },
      },
      build: {
        include: {
          componentes: {
            orderBy: { ordem: 'asc' as const },
            include: {
              hardware: {
                select: {
                  id: true,
                  nome: true,
                  categoria: true,
                  imagemUrl: true,
                },
              },
            },
          },
        },
      },
      especificacaoMonitor: true,
      especificacaoMouse: true,
      especificacaoTeclado: true,
      especificacaoHeadset: true,
      ofertas: {
        where: {
          status: StatusOferta.ATIVA,
          parceiro: { ativo: true },
          OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
        },
        orderBy: { preco: 'asc' as const },
        include: {
          parceiro: {
            select: {
              id: true,
              nome: true,
              slug: true,
              logoUrl: true,
              programaAfiliados: true,
            },
          },
        },
      },
    };
  }

  async listarCategoriasPublicas() {
    const categorias = await this.prisma.categoriaProduto.findMany({
      where: { ativo: true },
      orderBy: [{ grupo: 'asc' }, { ordem: 'asc' }, { nome: 'asc' }],
      select: {
        id: true,
        nome: true,
        slug: true,
        grupo: true,
        ordem: true,
        _count: {
          select: {
            produtos: {
              where: { ativo: true, publicado: true },
            },
          },
        },
      },
    });
    return { total: categorias.length, categorias };
  }

  async listarCategoriasAdmin() {
    return this.prisma.categoriaProduto.findMany({
      orderBy: [{ grupo: 'asc' }, { ordem: 'asc' }, { nome: 'asc' }],
      include: { _count: { select: { produtos: true } } },
    });
  }

  async criarCategoria(dados: CriarCategoriaProdutoDto) {
    try {
      return await this.prisma.categoriaProduto.create({
        data: {
          nome: dados.nome.trim(),
          slug: this.criarSlug(dados.slug),
          grupo: dados.grupo,
          ativo: dados.ativo ?? true,
          ordem: dados.ordem ?? 0,
        },
      });
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma categoria com este slug.');
      }
      throw erro;
    }
  }

  async atualizarCategoria(id: number, dados: AtualizarCategoriaProdutoDto) {
    const existente = await this.prisma.categoriaProduto.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existente) throw new NotFoundException('Categoria não encontrada.');

    return this.prisma.categoriaProduto.update({
      where: { id },
      data: {
        ...(dados.nome !== undefined && { nome: dados.nome.trim() }),
        ...(dados.slug !== undefined && { slug: this.criarSlug(dados.slug) }),
        ...(dados.grupo !== undefined && { grupo: dados.grupo }),
        ...(dados.ativo !== undefined && { ativo: dados.ativo }),
        ...(dados.ordem !== undefined && { ordem: dados.ordem }),
      },
    });
  }

  async listarPublicos(filtros: FiltrarProdutosDto) {
    if (
      filtros.precoMin !== undefined &&
      filtros.precoMax !== undefined &&
      filtros.precoMin > filtros.precoMax
    ) {
      throw new BadRequestException(
        'O preço mínimo não pode ser maior que o preço máximo.',
      );
    }

    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 24;
    const agora = new Date();

    const ofertaValida: Prisma.OfertaWhereInput = {
      status: StatusOferta.ATIVA,
      parceiro: {
        ativo: true,
        ...(filtros.parceiro && { slug: filtros.parceiro }),
      },
      OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
      ...(filtros.precoMin !== undefined && {
        preco: { gte: filtros.precoMin },
      }),
      ...(filtros.precoMax !== undefined && {
        preco: {
          ...(filtros.precoMin !== undefined && { gte: filtros.precoMin }),
          lte: filtros.precoMax,
        },
      }),
    };

    const where: Prisma.ProdutoWhereInput = {
      ativo: true,
      publicado: true,
      categoria: {
        ativo: true,
        ...(filtros.categoria && { slug: filtros.categoria }),
        ...(filtros.grupo && { grupo: filtros.grupo }),
      },
      ...(filtros.marca && {
        marca: { equals: filtros.marca, mode: 'insensitive' },
      }),
      ...(filtros.busca && {
        OR: [
          { nome: { contains: filtros.busca, mode: 'insensitive' } },
          { marca: { contains: filtros.busca, mode: 'insensitive' } },
          { modelo: { contains: filtros.busca, mode: 'insensitive' } },
          { descricao: { contains: filtros.busca, mode: 'insensitive' } },
        ],
      }),
      ...((filtros.comOferta ||
        filtros.precoMin !== undefined ||
        filtros.precoMax !== undefined ||
        filtros.parceiro) && {
        ofertas: { some: ofertaValida },
      }),
      ...((filtros.telaMin !== undefined ||
        filtros.hzMin !== undefined ||
        filtros.resolucao ||
        filtros.painel) && {
        especificacaoMonitor: {
          ...(filtros.telaMin !== undefined && {
            tamanhoPolegadas: { gte: filtros.telaMin },
          }),
          ...(filtros.hzMin !== undefined && {
            taxaAtualizacaoHz: { gte: filtros.hzMin },
          }),
          ...(filtros.resolucao && {
            resolucao: { contains: filtros.resolucao, mode: 'insensitive' },
          }),
          ...(filtros.painel && {
            tipoPainel: { contains: filtros.painel, mode: 'insensitive' },
          }),
        },
      }),
      ...((filtros.dpiMin !== undefined ||
        filtros.pollingRateMin !== undefined ||
        filtros.pesoMax !== undefined) && {
        especificacaoMouse: {
          ...(filtros.dpiMin !== undefined && {
            dpiMaximo: { gte: filtros.dpiMin },
          }),
          ...(filtros.pollingRateMin !== undefined && {
            pollingRateHz: { gte: filtros.pollingRateMin },
          }),
          ...(filtros.pesoMax !== undefined && {
            pesoGramas: { lte: filtros.pesoMax },
          }),
        },
      }),
      ...((filtros.switch || filtros.layout) && {
        especificacaoTeclado: {
          ...(filtros.switch && {
            switch: { contains: filtros.switch, mode: 'insensitive' },
          }),
          ...(filtros.layout && {
            layout: { contains: filtros.layout, mode: 'insensitive' },
          }),
        },
      }),
      ...((filtros.wireless !== undefined ||
        filtros.bateriaMin !== undefined) && {
        especificacaoHeadset: {
          ...(filtros.wireless !== undefined && { wireless: filtros.wireless }),
          ...(filtros.bateriaMin !== undefined && {
            bateriaHoras: { gte: filtros.bateriaMin },
          }),
        },
      }),
    };

    const [total, produtos] = await Promise.all([
      this.prisma.produto.count({ where }),
      this.prisma.produto.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ atualizadoEm: 'desc' }, { nome: 'asc' }],
        select: {
          id: true,
          tipo: true,
          nome: true,
          slug: true,
          marca: true,
          modelo: true,
          imagemUrl: true,
          imagemHoverUrl: true,
          categoria: {
            select: { id: true, nome: true, slug: true, grupo: true },
          },
          hardware: {
            select: {
              id: true,
              categoria: true,
              modelos3D: {
                where: { ativo: true, aprovado: true },
                take: 1,
                select: { id: true },
              },
            },
          },
          ofertas: {
            where: ofertaValida,
            orderBy: { preco: 'asc' },
            take: 1,
            select: {
              id: true,
              preco: true,
              precoAnterior: true,
              urlAfiliada: true,
              urlOriginal: true,
              parceiro: {
                select: { id: true, nome: true, slug: true, logoUrl: true },
              },
            },
          },
        },
      }),
    ]);

    const ids = produtos.map((produto) => produto.id);
    const avaliacoes =
      ids.length === 0
        ? []
        : await this.prisma.avaliacao.groupBy({
            by: ['produtoId'],
            where: {
              produtoId: { in: ids },
              status: StatusAvaliacao.PUBLICADA,
            },
            _avg: { nota: true },
            _count: { _all: true },
          });

    const avaliacoesPorProduto = new Map(
      avaliacoes.map((item) => [
        item.produtoId,
        { media: item._avg.nota ?? 0, quantidade: item._count._all },
      ]),
    );

    return {
      dados: produtos.map((produto) => ({
        ...produto,
        hardware: produto.hardware
          ? {
              id: produto.hardware.id,
              categoria: produto.hardware.categoria,
            }
          : null,
        possuiModelo3D: (produto.hardware?.modelos3D.length ?? 0) > 0,
        melhorOferta: produto.ofertas[0] ?? null,
        ofertas: undefined,
        avaliacao: avaliacoesPorProduto.get(produto.id) ?? {
          media: 0,
          quantidade: 0,
        },
      })),
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  private async buscarPublico(where: Prisma.ProdutoWhereUniqueInput) {
    const produto = await this.prisma.produto.findUnique({
      where,
      include: this.includeProdutoDetalhado(),
    });

    if (
      !produto ||
      !produto.ativo ||
      !produto.publicado ||
      !produto.categoria.ativo
    ) {
      throw new NotFoundException('Produto não encontrado.');
    }

    const avaliacao = await this.prisma.avaliacao.aggregate({
      where: { produtoId: produto.id, status: StatusAvaliacao.PUBLICADA },
      _avg: { nota: true },
      _count: { _all: true },
    });

    const especificacoesHardware =
      produto.hardware?.especificacaoProcessador ??
      produto.hardware?.especificacaoPlacaMae ??
      produto.hardware?.especificacaoMemoriaRam ??
      produto.hardware?.especificacaoPlacaVideo ??
      produto.hardware?.especificacaoArmazenamento ??
      produto.hardware?.especificacaoFonte ??
      produto.hardware?.especificacaoGabinete ??
      produto.hardware?.especificacaoCooler ??
      produto.hardware?.especificacaoVentoinha ??
      null;

    const especificacoes =
      produto.especificacaoMonitor ??
      produto.especificacaoMouse ??
      produto.especificacaoTeclado ??
      produto.especificacaoHeadset ??
      produto.notebook?.especificacao ??
      (produto.hardware && especificacoesHardware
        ? normalizarEspecificacoesHardwarePublicas(
            produto.hardware.categoria,
            especificacoesHardware,
          )
        : null) ??
      (produto.build
        ? {
            categoria: produto.build.categoria,
            finalidade: produto.build.finalidade,
            resolucaoRecomendada: produto.build.resolucaoRecomendada,
            consumoEstimadoWatts: produto.build.consumoEstimadoWatts,
            fonteRecomendadaWatts: produto.build.fonteRecomendadaWatts,
          }
        : null);

    return {
      ...produto,
      especificacoes,
      possuiModelo3D: (produto.hardware?.modelos3D.length ?? 0) > 0,
      avaliacao: {
        media: avaliacao._avg.nota ?? 0,
        quantidade: avaliacao._count._all,
      },
    };
  }

  buscarPublicoPorId(id: number) {
    return this.buscarPublico({ id });
  }

  buscarPublicoPorSlug(slug: string) {
    return this.buscarPublico({ slug });
  }

  async listarAdmin() {
    return this.prisma.produto.findMany({
      orderBy: { atualizadoEm: 'desc' },
      include: {
        categoria: true,
        hardware: { select: { id: true, categoria: true } },
        notebook: true,
        build: true,
        _count: { select: { ofertas: true, avaliacoes: true } },
      },
    });
  }

  async buscarAdmin(id: number) {
    const produto = await this.prisma.produto.findUnique({
      where: { id },
      include: this.includeProdutoDetalhado(),
    });
    if (!produto) throw new NotFoundException('Produto não encontrado.');
    return produto;
  }

  async criar(dados: CriarProdutoDto) {
    this.validarEspecificacaoUnica(dados);
    const categoria = await this.prisma.categoriaProduto.findFirst({
      where: { id: dados.categoriaId, ativo: true },
      select: { id: true, slug: true },
    });
    if (!categoria) throw new NotFoundException('Categoria não encontrada.');
    this.validarCategoriaProdutoGenerico(categoria.slug);
    this.validarEspecificacaoDaCategoria(dados, categoria.slug);

    if (
      dados.publicado === true &&
      new Set(['monitores', 'mouses', 'teclados', 'headsets']).has(
        categoria.slug,
      )
    ) {
      const possuiEspecificacao =
        dados.especificacaoMonitor !== undefined ||
        dados.especificacaoMouse !== undefined ||
        dados.especificacaoTeclado !== undefined ||
        dados.especificacaoHeadset !== undefined;
      if (!possuiEspecificacao) {
        throw new BadRequestException(
          'Um produto publicado nesta categoria precisa possuir sua especificação técnica.',
        );
      }
    }

    const duplicado = await this.prisma.produto.findFirst({
      where: {
        OR: [
          ...(dados.mpn?.trim() ? [{ mpn: dados.mpn.trim() }] : []),
          ...(dados.gtin?.trim() ? [{ gtin: dados.gtin.trim() }] : []),
          ...(dados.marca?.trim() && dados.modelo?.trim()
            ? [
                {
                  marca: {
                    equals: dados.marca.trim(),
                    mode: 'insensitive' as const,
                  },
                  modelo: {
                    equals: dados.modelo.trim(),
                    mode: 'insensitive' as const,
                  },
                },
              ]
            : []),
        ],
      },
      select: { id: true, nome: true, slug: true },
    });

    if (duplicado) {
      throw new ConflictException(
        `Possível produto duplicado: ID ${duplicado.id} — ${duplicado.nome}. Cadastre uma nova oferta no produto existente ou revise MPN/GTIN/modelo.`,
      );
    }

    const slug = await this.criarSlugUnico(
      `${dados.marca ?? ''} ${dados.modelo ?? ''} ${dados.nome}`,
    );

    try {
      return await this.prisma.produto.create({
        data: {
          categoriaId: dados.categoriaId,
          tipo: TipoProduto.GENERICO,
          nome: dados.nome.trim(),
          slug,
          marca: dados.marca?.trim() ?? null,
          modelo: dados.modelo?.trim() ?? null,
          descricao: dados.descricao?.trim() ?? null,
          mpn: dados.mpn?.trim() || null,
          gtin: dados.gtin?.trim() || null,
          imagemUrl: dados.imagemUrl?.trim() ?? null,
          imagemHoverUrl: dados.imagemHoverUrl?.trim() ?? null,
          metadados: dados.metadados as Prisma.InputJsonValue | undefined,
          publicado: dados.publicado ?? false,
          ativo: dados.ativo ?? true,
          especificacaoMonitor: dados.especificacaoMonitor
            ? { create: dados.especificacaoMonitor }
            : undefined,
          especificacaoMouse: dados.especificacaoMouse
            ? { create: dados.especificacaoMouse }
            : undefined,
          especificacaoTeclado: dados.especificacaoTeclado
            ? { create: dados.especificacaoTeclado }
            : undefined,
          especificacaoHeadset: dados.especificacaoHeadset
            ? { create: dados.especificacaoHeadset }
            : undefined,
        },
        include: this.includeProdutoDetalhado(),
      });
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe um produto com o mesmo slug, MPN ou GTIN.',
        );
      }
      throw erro;
    }
  }

  async atualizar(id: number, dados: AtualizarProdutoDto) {
    this.validarEspecificacaoUnica(dados);
    const atual = await this.prisma.produto.findUnique({
      where: { id },
      select: {
        id: true,
        tipo: true,
        nome: true,
        marca: true,
        modelo: true,
        publicado: true,
        categoria: { select: { id: true, slug: true } },
        especificacaoMonitor: { select: { id: true } },
        especificacaoMouse: { select: { id: true } },
        especificacaoTeclado: { select: { id: true } },
        especificacaoHeadset: { select: { id: true } },
      },
    });
    if (!atual) throw new NotFoundException('Produto não encontrado.');

    if (atual.tipo !== TipoProduto.GENERICO) {
      throw new BadRequestException(
        'Este produto possui um cadastro especializado. Use a rota administrativa de Hardware, Notebook ou PC Montado para editá-lo.',
      );
    }

    let categoriaSlug = atual.categoria.slug;
    if (dados.categoriaId !== undefined) {
      const categoria = await this.prisma.categoriaProduto.findUnique({
        where: { id: dados.categoriaId },
        select: { id: true, slug: true },
      });
      if (!categoria) throw new NotFoundException('Categoria não encontrada.');
      categoriaSlug = categoria.slug;
      this.validarCategoriaProdutoGenerico(categoriaSlug);
    }

    const categoriaEspecificacaoExistente = atual.especificacaoMonitor
      ? 'monitores'
      : atual.especificacaoMouse
        ? 'mouses'
        : atual.especificacaoTeclado
          ? 'teclados'
          : atual.especificacaoHeadset
            ? 'headsets'
            : null;

    if (
      dados.categoriaId !== undefined &&
      categoriaEspecificacaoExistente !== null &&
      categoriaEspecificacaoExistente !== categoriaSlug
    ) {
      throw new BadRequestException(
        'Não é possível mover um produto para outra categoria enquanto ele possui uma especificação específica da categoria atual.',
      );
    }

    this.validarEspecificacaoDaCategoria(dados, categoriaSlug);

    const ficaraPublicado = dados.publicado ?? atual.publicado;
    const exigeEspecificacao = new Set([
      'monitores',
      'mouses',
      'teclados',
      'headsets',
    ]).has(categoriaSlug);
    const possuiEspecificacaoAtual =
      atual.especificacaoMonitor !== null ||
      atual.especificacaoMouse !== null ||
      atual.especificacaoTeclado !== null ||
      atual.especificacaoHeadset !== null;
    const recebeuEspecificacao =
      dados.especificacaoMonitor !== undefined ||
      dados.especificacaoMouse !== undefined ||
      dados.especificacaoTeclado !== undefined ||
      dados.especificacaoHeadset !== undefined;

    if (
      ficaraPublicado &&
      exigeEspecificacao &&
      !possuiEspecificacaoAtual &&
      !recebeuEspecificacao
    ) {
      throw new BadRequestException(
        'Um produto publicado nesta categoria precisa possuir sua especificação técnica.',
      );
    }

    const nome = dados.nome?.trim() ?? atual.nome;
    const marca =
      dados.marca === undefined
        ? atual.marca
        : dados.marca === null
          ? null
          : dados.marca.trim() || null;
    const modelo =
      dados.modelo === undefined
        ? atual.modelo
        : dados.modelo === null
          ? null
          : dados.modelo.trim() || null;
    const atualizarSlug =
      dados.nome !== undefined ||
      dados.marca !== undefined ||
      dados.modelo !== undefined;
    const slug = atualizarSlug
      ? await this.criarSlugUnico(`${marca ?? ''} ${modelo ?? ''} ${nome}`, id)
      : undefined;

    try {
      return await this.prisma.produto.update({
        where: { id },
        data: {
          ...(dados.categoriaId !== undefined && {
            categoriaId: dados.categoriaId,
          }),
          ...(dados.nome !== undefined && { nome }),
          ...(slug !== undefined && { slug }),
          ...(dados.marca !== undefined && {
            marca: dados.marca === null ? null : dados.marca.trim() || null,
          }),
          ...(dados.modelo !== undefined && {
            modelo: dados.modelo === null ? null : dados.modelo.trim() || null,
          }),
          ...(dados.descricao !== undefined && {
            descricao:
              dados.descricao === null ? null : dados.descricao.trim() || null,
          }),
          ...(dados.mpn !== undefined && {
            mpn: dados.mpn === null ? null : dados.mpn.trim() || null,
          }),
          ...(dados.gtin !== undefined && {
            gtin: dados.gtin === null ? null : dados.gtin.trim() || null,
          }),
          ...(dados.imagemUrl !== undefined && {
            imagemUrl:
              dados.imagemUrl === null ? null : dados.imagemUrl.trim() || null,
          }),
          ...(dados.imagemHoverUrl !== undefined && {
            imagemHoverUrl:
              dados.imagemHoverUrl === null
                ? null
                : dados.imagemHoverUrl.trim() || null,
          }),
          ...(dados.metadados !== undefined && {
            metadados: dados.metadados as Prisma.InputJsonValue,
          }),
          ...(dados.publicado !== undefined && { publicado: dados.publicado }),
          ...(dados.ativo !== undefined && { ativo: dados.ativo }),
          especificacaoMonitor: dados.especificacaoMonitor
            ? {
                upsert: {
                  create: dados.especificacaoMonitor,
                  update: dados.especificacaoMonitor,
                },
              }
            : undefined,
          especificacaoMouse: dados.especificacaoMouse
            ? {
                upsert: {
                  create: dados.especificacaoMouse,
                  update: dados.especificacaoMouse,
                },
              }
            : undefined,
          especificacaoTeclado: dados.especificacaoTeclado
            ? {
                upsert: {
                  create: dados.especificacaoTeclado,
                  update: dados.especificacaoTeclado,
                },
              }
            : undefined,
          especificacaoHeadset: dados.especificacaoHeadset
            ? {
                upsert: {
                  create: dados.especificacaoHeadset,
                  update: dados.especificacaoHeadset,
                },
              }
            : undefined,
        },
        include: this.includeProdutoDetalhado(),
      });
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('MPN, GTIN ou slug já utilizado.');
      }
      throw erro;
    }
  }

  async arquivar(id: number) {
    const produto = await this.prisma.produto.findUnique({
      where: { id },
      select: { id: true, tipo: true },
    });
    if (!produto) throw new NotFoundException('Produto não encontrado.');
    if (produto.tipo !== TipoProduto.GENERICO) {
      throw new BadRequestException(
        'Este produto possui um cadastro especializado. Use a rota administrativa correspondente para arquivá-lo.',
      );
    }

    await this.prisma.produto.update({
      where: { id },
      data: { ativo: false, publicado: false },
    });
    return { mensagem: 'Produto arquivado com sucesso.' };
  }

  async importarProdutoPorUrl(urlOriginal: string) {
    const url = await this.validarUrlPublica(urlOriginal);
    const resposta = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'CriaByte-Importer/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (resposta.status >= 300 && resposta.status < 400) {
      throw new BadRequestException(
        'A URL retornou redirecionamento. Informe a URL final do produto.',
      );
    }
    if (!resposta.ok) {
      throw new BadRequestException(
        `Não foi possível importar a página (HTTP ${resposta.status}).`,
      );
    }

    const contentType = resposta.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      throw new BadRequestException('A URL não retornou uma página HTML.');
    }

    const texto = await this.lerHtmlLimitado(resposta);

    const jsonLd = this.extrairJsonLdProduto(texto);
    const nome =
      this.normalizarTexto(jsonLd?.name) ??
      this.extrairMeta(texto, 'og:title') ??
      /<title[^>]*>([^<]+)<\/title>/i.exec(texto)?.[1]?.trim() ??
      null;
    const descricao =
      this.normalizarTexto(jsonLd?.description) ??
      this.extrairMeta(texto, 'og:description') ??
      this.extrairMeta(texto, 'description');
    const imagemUrl =
      this.normalizarTexto(jsonLd?.image) ??
      this.extrairMeta(texto, 'og:image');
    const mpn = this.normalizarTexto(jsonLd?.mpn);
    const gtin =
      this.normalizarTexto(jsonLd?.gtin13) ??
      this.normalizarTexto(jsonLd?.gtin14) ??
      this.normalizarTexto(jsonLd?.gtin12) ??
      this.normalizarTexto(jsonLd?.gtin);

    let marca: string | null = null;
    const brand = jsonLd?.brand;
    if (typeof brand === 'string') marca = brand.trim() || null;
    if (brand && typeof brand === 'object') {
      marca = this.normalizarTexto((brand as Record<string, unknown>).name);
    }

    const dadosExtraidos = {
      nome,
      marca,
      modelo: this.normalizarTexto(jsonLd?.model),
      descricao,
      mpn,
      gtin,
      imagemUrl,
      urlOriginal: url.toString(),
    };

    const camposNaoEncontrados = Object.entries(dadosExtraidos)
      .filter(([chave, valor]) => chave !== 'urlOriginal' && !valor)
      .map(([chave]) => chave);

    const possiveisDuplicados = await this.prisma.produto.findMany({
      where: {
        OR: [
          ...(mpn ? [{ mpn }] : []),
          ...(gtin ? [{ gtin }] : []),
          ...(marca && dadosExtraidos.modelo
            ? [
                {
                  marca: { equals: marca, mode: 'insensitive' as const },
                  modelo: {
                    equals: dadosExtraidos.modelo,
                    mode: 'insensitive' as const,
                  },
                },
              ]
            : []),
        ],
      },
      select: { id: true, nome: true, slug: true, mpn: true, gtin: true },
      take: 10,
    });

    const hash = createHash('sha256').update(texto).digest('hex');
    const importacao = await this.prisma.importacaoProduto.create({
      data: {
        urlOrigem: url.toString(),
        status: StatusImportacao.AGUARDANDO_REVISAO,
        origemPrincipal: OrigemDadoProduto.LOJA,
        conteudoBruto: {
          ...(jsonLd !== null && { jsonLd }),
          titulo: nome,
        } as Prisma.InputJsonValue,
        dadosNormalizados: dadosExtraidos,
        camposNaoEncontrados,
        hashConteudo: hash,
        coletadoEm: new Date(),
      },
    });

    return {
      importacaoId: importacao.id,
      dadosExtraidos,
      dadosInterpretados: dadosExtraidos,
      camposNaoEncontrados,
      possiveisDuplicados,
      aviso:
        possiveisDuplicados.length > 0
          ? 'Foram encontrados possíveis produtos duplicados. Revise antes de cadastrar.'
          : null,
    };
  }

  async listarImportacoes() {
    return this.prisma.importacaoProduto.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        produto: { select: { id: true, nome: true, slug: true } },
        revisadoPor: { select: { id: true, nome: true } },
      },
    });
  }

  async revisarImportacao(
    id: number,
    usuarioId: number | undefined,
    dados: RevisarImportacaoProdutoDto,
  ) {
    const importacao = await this.prisma.importacaoProduto.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!importacao) throw new NotFoundException('Importação não encontrada.');

    if (dados.produtoId !== undefined) {
      const produto = await this.prisma.produto.findUnique({
        where: { id: dados.produtoId },
        select: { id: true },
      });
      if (!produto) throw new NotFoundException('Produto não encontrado.');
    }

    return this.prisma.importacaoProduto.update({
      where: { id },
      data: {
        status: dados.aprovada
          ? StatusImportacao.APROVADA
          : StatusImportacao.REJEITADA,
        produtoId: dados.produtoId ?? null,
        revisadoPorId: usuarioId ?? null,
        revisadoEm: new Date(),
      },
    });
  }
}
