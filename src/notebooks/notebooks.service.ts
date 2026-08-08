import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  GrupoCategoriaProduto,
  StatusAvaliacao,
  StatusOferta,
  TipoProduto,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarNotebookDto } from './dtos/atualizar-notebook.dto';
import { CriarEspecificacaoNotebookDto } from './dtos/criar-especificacao-notebook.dto';
import { CriarNotebookDto } from './dtos/criar-notebook.dto';
import { FiltrarNotebooksDto } from './dtos/filtrar-notebooks.dto';

@Injectable()
export class NotebooksService {
  constructor(private readonly prisma: PrismaService) {}

  private criarSlug(texto: string): string {
    return (
      texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'notebook'
    );
  }

  private async criarSlugUnico(texto: string, ignorarProdutoId?: number) {
    const base = this.criarSlug(texto);
    let slug = base;
    let numero = 2;
    while (true) {
      const existente = await this.prisma.produto.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existente || existente.id === ignorarProdutoId) return slug;
      slug = `${base}-${numero++}`;
    }
  }

  private validarEspecificacao(
    especificacao: CriarEspecificacaoNotebookDto,
  ): void {
    if (
      especificacao.slotsRamTotal !== undefined &&
      especificacao.slotsRamLivres !== undefined &&
      especificacao.slotsRamLivres > especificacao.slotsRamTotal
    ) {
      throw new BadRequestException(
        'A quantidade de slots RAM livres não pode ser maior que o total de slots.',
      );
    }

    if (
      especificacao.ramInstaladaGb !== undefined &&
      especificacao.ramSoldadaGb !== undefined &&
      especificacao.ramSoldadaGb > especificacao.ramInstaladaGb
    ) {
      throw new BadRequestException(
        'A memória RAM soldada não pode ser maior que a memória instalada.',
      );
    }

    if (
      especificacao.ramInstaladaGb !== undefined &&
      especificacao.ramMaximaGb !== undefined &&
      especificacao.ramInstaladaGb > especificacao.ramMaximaGb
    ) {
      throw new BadRequestException(
        'A memória RAM instalada não pode ser maior que a capacidade máxima.',
      );
    }

    if (
      especificacao.slotsM2Total !== undefined &&
      especificacao.slotsM2Livres !== undefined &&
      especificacao.slotsM2Livres > especificacao.slotsM2Total
    ) {
      throw new BadRequestException(
        'A quantidade de slots M.2 livres não pode ser maior que o total de slots M.2.',
      );
    }

    if (
      especificacao.nucleos !== undefined &&
      especificacao.threads !== undefined &&
      especificacao.threads < especificacao.nucleos
    ) {
      throw new BadRequestException(
        'A quantidade de threads não pode ser menor que a quantidade de núcleos.',
      );
    }
  }

  private async garantirCategoriaNotebooks() {
    return this.prisma.categoriaProduto.upsert({
      where: { slug: 'notebooks' },
      create: {
        nome: 'Notebooks',
        slug: 'notebooks',
        grupo: GrupoCategoriaProduto.COMPUTADORES,
        ordem: 20,
      },
      update: {},
      select: { id: true },
    });
  }

  private includeDetalhado() {
    const agora = new Date();
    return {
      produto: {
        include: {
          categoria: true,
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
        },
      },
      especificacao: true,
    };
  }

  async criar(dados: CriarNotebookDto) {
    this.validarEspecificacao(dados.especificacao);
    const categoria = await this.garantirCategoriaNotebooks();

    const duplicado = await this.prisma.produto.findFirst({
      where: {
        OR: [
          ...(dados.mpn?.trim() ? [{ mpn: dados.mpn.trim() }] : []),
          ...(dados.gtin?.trim() ? [{ gtin: dados.gtin.trim() }] : []),
          {
            marca: { equals: dados.marca.trim(), mode: 'insensitive' },
            modelo: { equals: dados.modelo.trim(), mode: 'insensitive' },
          },
        ],
      },
      select: { id: true, nome: true },
    });

    if (duplicado) {
      throw new ConflictException(
        `Possível notebook duplicado: produto ID ${duplicado.id} — ${duplicado.nome}.`,
      );
    }

    const slug = await this.criarSlugUnico(
      `${dados.marca} ${dados.modelo} ${dados.nome}`,
    );

    try {
      return await this.prisma.notebook.create({
        data: {
          produto: {
            create: {
              categoriaId: categoria.id,
              tipo: TipoProduto.NOTEBOOK,
              nome: dados.nome.trim(),
              slug,
              marca: dados.marca.trim(),
              modelo: dados.modelo.trim(),
              descricao: dados.descricao?.trim() ?? null,
              mpn: dados.mpn?.trim() || null,
              gtin: dados.gtin?.trim() || null,
              imagemUrl: dados.imagemUrl?.trim() ?? null,
              imagemHoverUrl: dados.imagemHoverUrl?.trim() ?? null,
              publicado: dados.publicado ?? false,
              ativo: dados.ativo ?? true,
            },
          },
          especificacao: { create: dados.especificacao },
        },
        include: this.includeDetalhado(),
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

  async listarPublicos(filtros: FiltrarNotebooksDto) {
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

    const where: Prisma.NotebookWhereInput = {
      produto: {
        ativo: true,
        publicado: true,
        ...(filtros.marca && {
          marca: { equals: filtros.marca, mode: 'insensitive' },
        }),
        ...(filtros.busca && {
          OR: [
            { nome: { contains: filtros.busca, mode: 'insensitive' } },
            { marca: { contains: filtros.busca, mode: 'insensitive' } },
            { modelo: { contains: filtros.busca, mode: 'insensitive' } },
          ],
        }),
        ...((filtros.precoMin !== undefined ||
          filtros.precoMax !== undefined) && {
          ofertas: {
            some: {
              status: StatusOferta.ATIVA,
              parceiro: { ativo: true },
              OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
              preco: {
                ...(filtros.precoMin !== undefined && {
                  gte: filtros.precoMin,
                }),
                ...(filtros.precoMax !== undefined && {
                  lte: filtros.precoMax,
                }),
              },
            },
          },
        }),
      },
      especificacao: {
        ...(filtros.processador && {
          processadorNome: {
            contains: filtros.processador,
            mode: 'insensitive',
          },
        }),
        ...(filtros.gpu && {
          gpuNome: { contains: filtros.gpu, mode: 'insensitive' },
        }),
        ...(filtros.ramMin !== undefined && {
          ramInstaladaGb: { gte: filtros.ramMin },
        }),
        ...(filtros.telaMin !== undefined && {
          tamanhoTelaPolegadas: { gte: filtros.telaMin },
        }),
        ...(filtros.hzMin !== undefined && {
          taxaAtualizacaoHz: { gte: filtros.hzMin },
        }),
      },
    };

    const [total, notebooks] = await Promise.all([
      this.prisma.notebook.count({ where }),
      this.prisma.notebook.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: { atualizadoEm: 'desc' },
        include: {
          especificacao: true,
          produto: {
            include: {
              categoria: true,
              ofertas: {
                where: {
                  status: StatusOferta.ATIVA,
                  parceiro: { ativo: true },
                  OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
                },
                orderBy: { preco: 'asc' },
                take: 1,
                include: {
                  parceiro: {
                    select: { id: true, nome: true, slug: true, logoUrl: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const produtoIds = notebooks.map((notebook) => notebook.produtoId);
    const avaliacoes =
      produtoIds.length === 0
        ? []
        : await this.prisma.avaliacao.groupBy({
            by: ['produtoId'],
            where: {
              produtoId: { in: produtoIds },
              status: StatusAvaliacao.PUBLICADA,
            },
            _avg: { nota: true },
            _count: { _all: true },
          });
    const mapa = new Map(
      avaliacoes.map((item) => [
        item.produtoId,
        { media: item._avg.nota ?? 0, quantidade: item._count._all },
      ]),
    );

    return {
      dados: notebooks.map((notebook) => ({
        ...notebook,
        avaliacao: mapa.get(notebook.produtoId) ?? { media: 0, quantidade: 0 },
        melhorOferta: notebook.produto.ofertas[0] ?? null,
      })),
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  async buscarPublico(id: number) {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id },
      include: this.includeDetalhado(),
    });
    if (!notebook || !notebook.produto.ativo || !notebook.produto.publicado) {
      throw new NotFoundException('Notebook não encontrado.');
    }

    const avaliacao = await this.prisma.avaliacao.aggregate({
      where: {
        produtoId: notebook.produtoId,
        status: StatusAvaliacao.PUBLICADA,
      },
      _avg: { nota: true },
      _count: { _all: true },
    });

    return {
      ...notebook,
      avaliacao: {
        media: avaliacao._avg.nota ?? 0,
        quantidade: avaliacao._count._all,
      },
    };
  }

  listarAdmin() {
    return this.prisma.notebook.findMany({
      orderBy: { atualizadoEm: 'desc' },
      include: this.includeDetalhado(),
    });
  }

  async buscarAdmin(id: number) {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id },
      include: this.includeDetalhado(),
    });
    if (!notebook) throw new NotFoundException('Notebook não encontrado.');
    return notebook;
  }

  async atualizar(id: number, dados: AtualizarNotebookDto) {
    const atual = await this.prisma.notebook.findUnique({
      where: { id },
      include: { produto: true, especificacao: true },
    });
    if (!atual) throw new NotFoundException('Notebook não encontrado.');

    if (dados.especificacao !== undefined) {
      this.validarEspecificacao({
        ...(atual.especificacao ?? {}),
        ...dados.especificacao,
      });
    }

    const nome = dados.nome?.trim() ?? atual.produto.nome;
    const marca = dados.marca?.trim() ?? atual.produto.marca ?? '';
    const modelo = dados.modelo?.trim() ?? atual.produto.modelo ?? '';
    const slug =
      dados.nome !== undefined ||
      dados.marca !== undefined ||
      dados.modelo !== undefined
        ? await this.criarSlugUnico(
            `${marca} ${modelo} ${nome}`,
            atual.produtoId,
          )
        : undefined;

    return this.prisma.notebook.update({
      where: { id },
      data: {
        produto: {
          update: {
            ...(dados.nome !== undefined && { nome }),
            ...(slug !== undefined && { slug }),
            ...(dados.marca !== undefined && { marca: dados.marca.trim() }),
            ...(dados.modelo !== undefined && { modelo: dados.modelo.trim() }),
            ...(dados.descricao !== undefined && {
              descricao:
                dados.descricao === null
                  ? null
                  : dados.descricao.trim() || null,
            }),
            ...(dados.mpn !== undefined && {
              mpn: dados.mpn === null ? null : dados.mpn.trim() || null,
            }),
            ...(dados.gtin !== undefined && {
              gtin: dados.gtin === null ? null : dados.gtin.trim() || null,
            }),
            ...(dados.imagemUrl !== undefined && {
              imagemUrl:
                dados.imagemUrl === null
                  ? null
                  : dados.imagemUrl.trim() || null,
            }),
            ...(dados.imagemHoverUrl !== undefined && {
              imagemHoverUrl:
                dados.imagemHoverUrl === null
                  ? null
                  : dados.imagemHoverUrl.trim() || null,
            }),
            ...(dados.publicado !== undefined && {
              publicado: dados.publicado,
            }),
            ...(dados.ativo !== undefined && { ativo: dados.ativo }),
          },
        },
        especificacao: dados.especificacao
          ? {
              upsert: {
                create: dados.especificacao,
                update: dados.especificacao,
              },
            }
          : undefined,
      },
      include: this.includeDetalhado(),
    });
  }

  async arquivar(id: number) {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id },
      select: { produtoId: true },
    });
    if (!notebook) throw new NotFoundException('Notebook não encontrado.');
    await this.prisma.produto.update({
      where: { id: notebook.produtoId },
      data: { ativo: false, publicado: false },
    });
    return { mensagem: 'Notebook arquivado com sucesso.' };
  }

  async obterProdutoId(notebookId: number) {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id: notebookId },
      select: { produtoId: true },
    });
    if (!notebook) throw new NotFoundException('Notebook não encontrado.');
    return notebook.produtoId;
  }
}
