import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  CategoriaHardware,
  GrupoCategoriaProduto,
  StatusAvaliacao,
  StatusOferta,
  TipoProduto,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarBuildDto } from './dtos/atualizar-build.dto';
import { BuildComponenteDto, CriarBuildDto } from './dtos/criar-build.dto';
import { FiltrarBuildsDto } from './dtos/filtrar-builds.dto';

@Injectable()
export class BuildsService {
  constructor(private readonly prisma: PrismaService) {}

  private criarSlug(texto: string): string {
    return (
      texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'pc-montado'
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

  private async garantirCategoria() {
    return this.prisma.categoriaProduto.upsert({
      where: { slug: 'pcs-montados' },
      create: {
        nome: 'PCs montados',
        slug: 'pcs-montados',
        grupo: GrupoCategoriaProduto.COMPUTADORES,
        ordem: 10,
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
                select: { id: true, nome: true, slug: true, logoUrl: true },
              },
            },
          },
        },
      },
      componentes: {
        orderBy: { ordem: 'asc' as const },
        include: {
          hardware: {
            include: {
              especificacaoProcessador: true,
              especificacaoPlacaVideo: true,
              especificacaoArmazenamento: true,
              especificacaoVentoinha: true,
              especificacaoCooler: true,
              especificacaoFonte: true,
            },
          },
        },
      },
    };
  }

  private async validarComponentes(
    componentes: BuildComponenteDto[],
    exigirPublicados: boolean,
  ) {
    const ids = [...new Set(componentes.map((item) => item.hardwareId))];
    const hardwares = await this.prisma.hardware.findMany({
      where: {
        id: { in: ids },
        ativo: true,
        ...(exigirPublicados && { publicado: true }),
      },
      select: { id: true, categoria: true },
    });
    if (hardwares.length !== ids.length) {
      throw new BadRequestException(
        exigirPublicados
          ? 'Um ou mais componentes da build não existem, estão inativos ou não estão publicados.'
          : 'Um ou mais componentes da build não existem ou estão inativos.',
      );
    }
    const mapa = new Map(hardwares.map((hardware) => [hardware.id, hardware]));
    for (const componente of componentes) {
      const hardware = mapa.get(componente.hardwareId);
      if (!hardware || hardware.categoria !== componente.categoria) {
        throw new BadRequestException(
          `A categoria informada para o hardware ${componente.hardwareId} não corresponde ao cadastro.`,
        );
      }
    }
  }

  private async validarCompletudeBuild(
    componentes: BuildComponenteDto[],
  ): Promise<void> {
    const obrigatorias = [
      CategoriaHardware.PROCESSADOR,
      CategoriaHardware.PLACA_MAE,
      CategoriaHardware.MEMORIA_RAM,
      CategoriaHardware.ARMAZENAMENTO,
      CategoriaHardware.FONTE,
      CategoriaHardware.GABINETE,
    ];
    const categorias = new Set(componentes.map((item) => item.categoria));
    const ausentes = obrigatorias.filter(
      (categoria) => !categorias.has(categoria),
    );

    if (ausentes.length > 0) {
      throw new BadRequestException(
        `Uma build publicada precisa conter: ${ausentes.join(', ')}.`,
      );
    }

    const categoriasUnitarias = [
      CategoriaHardware.PROCESSADOR,
      CategoriaHardware.PLACA_MAE,
      CategoriaHardware.FONTE,
      CategoriaHardware.GABINETE,
    ];

    for (const categoria of categoriasUnitarias) {
      const quantidade = componentes
        .filter((item) => item.categoria === categoria)
        .reduce((total, item) => total + (item.quantidade ?? 1), 0);
      if (quantidade !== 1) {
        throw new BadRequestException(
          `Uma build publicada deve possuir exatamente uma unidade da categoria ${categoria}.`,
        );
      }
    }

    if (!categorias.has(CategoriaHardware.PLACA_VIDEO)) {
      const processadorId = componentes.find(
        (item) => item.categoria === CategoriaHardware.PROCESSADOR,
      )?.hardwareId;

      const processador = processadorId
        ? await this.prisma.hardware.findUnique({
            where: { id: processadorId },
            select: {
              especificacaoProcessador: {
                select: { possuiVideoIntegrado: true },
              },
            },
          })
        : null;

      if (!processador?.especificacaoProcessador?.possuiVideoIntegrado) {
        throw new BadRequestException(
          'A build não possui placa de vídeo e o processador informado não possui vídeo integrado.',
        );
      }
    }
  }

  private async calcularConsumo(componentes: BuildComponenteDto[]) {
    const ids = [...new Set(componentes.map((item) => item.hardwareId))];
    const hardwares = await this.prisma.hardware.findMany({
      where: { id: { in: ids } },
      include: {
        especificacaoProcessador: true,
        especificacaoMemoriaRam: true,
        especificacaoPlacaVideo: true,
        especificacaoArmazenamento: true,
        especificacaoVentoinha: true,
        especificacaoCooler: true,
      },
    });
    const mapa = new Map(hardwares.map((hardware) => [hardware.id, hardware]));
    let watts = 50;

    for (const componente of componentes) {
      const hardware = mapa.get(componente.hardwareId);
      if (!hardware) continue;
      const quantidade = componente.quantidade ?? 1;
      let unitario = 0;
      if (hardware.categoria === CategoriaHardware.PROCESSADOR) {
        unitario = hardware.especificacaoProcessador?.tdpWatts ?? 0;
      } else if (hardware.categoria === CategoriaHardware.MEMORIA_RAM) {
        unitario = hardware.especificacaoMemoriaRam?.consumoWatts ?? 0;
      } else if (hardware.categoria === CategoriaHardware.PLACA_VIDEO) {
        unitario = hardware.especificacaoPlacaVideo?.consumoWatts ?? 0;
      } else if (hardware.categoria === CategoriaHardware.ARMAZENAMENTO) {
        unitario = hardware.especificacaoArmazenamento?.consumoWatts ?? 0;
      } else if (hardware.categoria === CategoriaHardware.VENTOINHA) {
        const fan = hardware.especificacaoVentoinha;
        unitario =
          fan?.tensaoVolts !== null &&
          fan?.tensaoVolts !== undefined &&
          fan.correnteAmperes !== null &&
          fan.correnteAmperes !== undefined
            ? fan.tensaoVolts * fan.correnteAmperes
            : 0;
      } else if (hardware.categoria === CategoriaHardware.COOLER) {
        unitario =
          hardware.especificacaoCooler?.consumoWatts ??
          hardware.especificacaoCooler?.consumoBombaWatts ??
          0;
      }
      watts += unitario * quantidade;
    }

    const recomendada = Math.max(200, Math.ceil((watts * 1.3) / 50) * 50);
    return {
      consumoEstimadoWatts: Number(watts.toFixed(2)),
      fonteRecomendadaWatts: recomendada,
    };
  }

  async criar(dados: CriarBuildDto) {
    await this.validarComponentes(dados.componentes, dados.publicado === true);
    if (dados.publicado === true) {
      await this.validarCompletudeBuild(dados.componentes);
    }
    const consumo = await this.calcularConsumo(dados.componentes);
    const categoria = await this.garantirCategoria();
    const slug = await this.criarSlugUnico(dados.nome);

    return this.prisma.build.create({
      data: {
        produto: {
          create: {
            categoriaId: categoria.id,
            tipo: TipoProduto.BUILD,
            nome: dados.nome.trim(),
            slug,
            marca: dados.marca?.trim() ?? null,
            modelo: dados.modelo?.trim() ?? null,
            descricao: dados.descricao?.trim() ?? null,
            imagemUrl: dados.imagemUrl?.trim() ?? null,
            imagemHoverUrl: dados.imagemHoverUrl?.trim() ?? null,
            publicado: dados.publicado ?? false,
            ativo: dados.ativo ?? true,
          },
        },
        categoria: dados.categoria?.trim() ?? null,
        finalidade: dados.finalidade?.trim() ?? null,
        resolucaoRecomendada: dados.resolucaoRecomendada?.trim() ?? null,
        configuracao3D: dados.configuracao3D as
          Prisma.InputJsonValue | undefined,
        ...consumo,
        componentes: {
          create: dados.componentes.map((item, indice) => ({
            hardwareId: item.hardwareId,
            categoria: item.categoria,
            quantidade: item.quantidade ?? 1,
            posicao: item.posicao ?? null,
            ordem: item.ordem ?? indice,
          })),
        },
      },
      include: this.includeDetalhado(),
    });
  }

  async listarPublicos(filtros: FiltrarBuildsDto) {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 24;
    const agora = new Date();
    const where: Prisma.BuildWhereInput = {
      produto: {
        ativo: true,
        publicado: true,
        ...(filtros.busca && {
          OR: [
            { nome: { contains: filtros.busca, mode: 'insensitive' } },
            { descricao: { contains: filtros.busca, mode: 'insensitive' } },
          ],
        }),
        ...((filtros.precoMin !== undefined ||
          filtros.precoMax !== undefined ||
          filtros.parceiro !== undefined) && {
          ofertas: {
            some: {
              status: StatusOferta.ATIVA,
              parceiro: {
                ativo: true,
                ...(filtros.parceiro && { slug: filtros.parceiro }),
              },
              preco: {
                ...(filtros.precoMin !== undefined && {
                  gte: filtros.precoMin,
                }),
                ...(filtros.precoMax !== undefined && {
                  lte: filtros.precoMax,
                }),
              },
              OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
            },
          },
        }),
      },
      ...(filtros.uso && {
        finalidade: { contains: filtros.uso, mode: 'insensitive' },
      }),
      ...(filtros.resolucao && {
        resolucaoRecomendada: {
          contains: filtros.resolucao,
          mode: 'insensitive',
        },
      }),
      ...(filtros.categoria && {
        categoria: { contains: filtros.categoria, mode: 'insensitive' },
      }),
    };

    const [total, builds] = await Promise.all([
      this.prisma.build.count({ where }),
      this.prisma.build.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: { atualizadoEm: 'desc' },
        include: this.includeDetalhado(),
      }),
    ]);

    return {
      dados: builds.map((build) => ({
        ...build,
        melhorOferta: build.produto.ofertas[0] ?? null,
      })),
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  async buscarPublico(id: number) {
    const build = await this.prisma.build.findUnique({
      where: { id },
      include: this.includeDetalhado(),
    });
    if (!build || !build.produto.ativo || !build.produto.publicado) {
      throw new NotFoundException('PC montado não encontrado.');
    }
    const avaliacao = await this.prisma.avaliacao.aggregate({
      where: { produtoId: build.produtoId, status: StatusAvaliacao.PUBLICADA },
      _avg: { nota: true },
      _count: { _all: true },
    });
    return {
      ...build,
      avaliacao: {
        media: avaliacao._avg.nota ?? 0,
        quantidade: avaliacao._count._all,
      },
    };
  }

  listarAdmin() {
    return this.prisma.build.findMany({
      orderBy: { atualizadoEm: 'desc' },
      include: this.includeDetalhado(),
    });
  }

  async buscarAdmin(id: number) {
    const build = await this.prisma.build.findUnique({
      where: { id },
      include: this.includeDetalhado(),
    });

    if (!build) {
      throw new NotFoundException('PC montado não encontrado.');
    }

    return build;
  }

  async atualizar(id: number, dados: AtualizarBuildDto) {
    const atual = await this.prisma.build.findUnique({
      where: { id },
      include: { produto: true },
    });
    if (!atual) throw new NotFoundException('PC montado não encontrado.');

    let consumo:
      | { consumoEstimadoWatts: number; fonteRecomendadaWatts: number }
      | undefined;
    if (dados.componentes !== undefined) {
      const ficaraPublicada =
        dados.publicado === true ||
        (dados.publicado === undefined && atual.produto.publicado);
      await this.validarComponentes(dados.componentes, ficaraPublicada);
      if (ficaraPublicada) {
        await this.validarCompletudeBuild(dados.componentes);
      }
      consumo = await this.calcularConsumo(dados.componentes);
    } else if (dados.publicado === true && !atual.produto.publicado) {
      const componentesAtuais = await this.prisma.buildComponente.findMany({
        where: { buildId: id },
        select: {
          hardwareId: true,
          categoria: true,
          quantidade: true,
        },
      });
      await this.validarComponentes(componentesAtuais, true);
      await this.validarCompletudeBuild(componentesAtuais);
    }

    const nome = dados.nome?.trim() ?? atual.produto.nome;
    const slug =
      dados.nome !== undefined
        ? await this.criarSlugUnico(nome, atual.produtoId)
        : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (dados.componentes !== undefined) {
        await tx.buildComponente.deleteMany({ where: { buildId: id } });
        if (dados.componentes.length > 0) {
          await tx.buildComponente.createMany({
            data: dados.componentes.map((item, indice) => ({
              buildId: id,
              hardwareId: item.hardwareId,
              categoria: item.categoria,
              quantidade: item.quantidade ?? 1,
              posicao: item.posicao ?? null,
              ordem: item.ordem ?? indice,
            })),
          });
        }
      }

      await tx.build.update({
        where: { id },
        data: {
          ...(dados.categoria !== undefined && {
            categoria: dados.categoria.trim() || null,
          }),
          ...(dados.finalidade !== undefined && {
            finalidade: dados.finalidade.trim() || null,
          }),
          ...(dados.resolucaoRecomendada !== undefined && {
            resolucaoRecomendada: dados.resolucaoRecomendada.trim() || null,
          }),
          ...(dados.configuracao3D !== undefined && {
            configuracao3D: dados.configuracao3D as Prisma.InputJsonValue,
          }),
          ...(consumo ?? {}),
          produto: {
            update: {
              ...(dados.nome !== undefined && { nome }),
              ...(slug !== undefined && { slug }),
              ...(dados.marca !== undefined && {
                marca: dados.marca.trim() || null,
              }),
              ...(dados.modelo !== undefined && {
                modelo: dados.modelo.trim() || null,
              }),
              ...(dados.descricao !== undefined && {
                descricao: dados.descricao.trim() || null,
              }),
              ...(dados.imagemUrl !== undefined && {
                imagemUrl: dados.imagemUrl.trim() || null,
              }),
              ...(dados.imagemHoverUrl !== undefined && {
                imagemHoverUrl: dados.imagemHoverUrl.trim() || null,
              }),
              ...(dados.publicado !== undefined && {
                publicado: dados.publicado,
              }),
              ...(dados.ativo !== undefined && { ativo: dados.ativo }),
            },
          },
        },
      });

      return tx.build.findUniqueOrThrow({
        where: { id },
        include: this.includeDetalhado(),
      });
    });
  }

  async arquivar(id: number) {
    const build = await this.prisma.build.findUnique({
      where: { id },
      select: { produtoId: true },
    });
    if (!build) throw new NotFoundException('PC montado não encontrado.');

    await this.prisma.produto.update({
      where: { id: build.produtoId },
      data: { ativo: false, publicado: false },
    });

    return { mensagem: 'PC montado arquivado com sucesso.' };
  }

  async abrirNo3D(id: number) {
    const build = await this.buscarPublico(id);
    return {
      buildId: build.id,
      produtoId: build.produtoId,
      configuracao3D: build.configuracao3D,
      componentes: build.componentes.map((componente) => ({
        hardwareId: componente.hardwareId,
        categoria: componente.categoria,
        quantidade: componente.quantidade,
        posicao: componente.posicao,
      })),
      aviso:
        build.configuracao3D === null
          ? 'A build não possui uma configuração de pontos 3D salva; o frontend pode usar os componentes para iniciar uma montagem.'
          : null,
    };
  }

  async obterProdutoId(buildId: number) {
    const build = await this.prisma.build.findUnique({
      where: { id: buildId },
      select: { produtoId: true },
    });
    if (!build) throw new NotFoundException('PC montado não encontrado.');
    return build.produtoId;
  }
}
