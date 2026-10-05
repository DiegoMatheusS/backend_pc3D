import { assertCatalogIdentityAvailable } from '../common/catalog-identity';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  GrupoCategoriaProduto,
  StatusOferta,
  TipoProduto,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { BuildsService } from './builds.service';
import { AtualizarBuildDto } from './dtos/atualizar-build.dto';
import { BuildComponenteDto, CriarBuildDto } from './dtos/criar-build.dto';

/**
 * Os anúncios comerciais não são builds de compatibilidade do PC Builder.
 * Uma loja pode informar somente "RAM 16 GB", sem a marca/modelo de cada peça.
 * Não exigir catálogo completo, preço ou oferta individual para publicá-los.
 * As regras técnicas do BuildsService seguem intactas para builds da comunidade/3D.
 */
@Injectable()
export class BuildsCatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builds: BuildsService,
  ) {}

  private ehKit(categoria?: string | null): boolean {
    return /^KIT[_ -]?UPGRADE$/i.test((categoria ?? '').trim());
  }

  private async categoriaComercial(categoria?: string | null) {
    const kit = this.ehKit(categoria);
    const slug = kit ? 'kits-de-upgrade' : 'pcs-montados';
    return this.prisma.categoriaProduto.upsert({
      where: { slug },
      create: {
        nome: kit ? 'Kits de upgrade' : 'PCs montados',
        slug,
        grupo: GrupoCategoriaProduto.COMPUTADORES,
        ordem: kit ? 11 : 10,
      },
      update: {},
      select: { id: true },
    });
  }

  private async slugUnico(nome: string, ignorarProdutoId?: number) {
    const base =
      nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'pc-montado';
    let slug = base;
    let contador = 2;
    while (true) {
      const encontrado = await this.prisma.produto.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!encontrado || encontrado.id === ignorarProdutoId) return slug;
      slug = `${base}-${contador++}`;
    }
  }

  private async validarVinculos(componentes: BuildComponenteDto[]) {
    const ids = [...new Set(componentes.map((item) => item.hardwareId))];
    if (ids.length === 0) return;
    const hardwares = await this.prisma.hardware.findMany({
      where: { id: { in: ids }, ativo: true },
      select: { id: true, categoria: true },
    });
    const mapa = new Map(hardwares.map((item) => [item.id, item.categoria]));
    for (const item of componentes) {
      if (!mapa.has(item.hardwareId)) {
        throw new BadRequestException(
          `Hardware ${item.hardwareId} não encontrado ou inativo. Remova o vínculo e mantenha a informação na descrição.`,
        );
      }
      if (mapa.get(item.hardwareId) !== item.categoria) {
        throw new BadRequestException(
          `A categoria do hardware ${item.hardwareId} não corresponde ao catálogo.`,
        );
      }
    }
  }

  private validarDescricaoParaPublicar(
    publicado: boolean,
    descricao: string | null | undefined,
    totalVinculos: number,
  ) {
    if (publicado && !descricao?.trim() && totalVinculos === 0) {
      throw new BadRequestException(
        'Para publicar, informe a descrição original ou vincule pelo menos um hardware identificado.',
      );
    }
  }

  async criar(dados: CriarBuildDto) {
    if (dados.oferta) {
      const parceiro = await this.prisma.parceiro.findFirst({
        where: { id: dados.oferta.parceiroId, ativo: true },
        select: { id: true },
      });
      if (!parceiro)
        throw new BadRequestException(
          'Selecione uma loja ativa para a oferta do PC.',
        );
    }

    const componentes = dados.componentes ?? [];
    await this.validarVinculos(componentes);
    this.validarDescricaoParaPublicar(
      dados.publicado === true,
      dados.descricao,
      componentes.length,
    );
    const categoria = await this.categoriaComercial(dados.categoria);
    const slug = await this.slugUnico(dados.nome);
    const criado = await this.prisma.$transaction(async (tx) => {
      await assertCatalogIdentityAvailable(tx, dados);
      return tx.build.create({
        data: {
          produto: {
            create: {
              categoriaId: categoria.id,
              tipo: TipoProduto.BUILD,
              nome: dados.nome.trim(),
              slug,
              marca: dados.marca?.trim() || null,
              modelo: dados.modelo?.trim() || null,
              descricao: dados.descricao?.trim() || null,
              imagemUrl: dados.imagemUrl?.trim() || null,
              imagemHoverUrl: dados.imagemHoverUrl?.trim() || null,
              publicado: dados.publicado ?? false,
              ativo: dados.ativo ?? true,
              ...(dados.oferta
                ? {
                    ofertas: {
                      create: {
                        parceiroId: dados.oferta.parceiroId,
                        preco: dados.oferta.preco,
                        urlOriginal: dados.oferta.urlOriginal,
                        urlAfiliada: dados.oferta.urlAfiliada ?? null,
                        status: StatusOferta.ATIVA,
                      },
                    },
                  }
                : {}),
            },
          },
          categoria: dados.categoria?.trim() || null,
          finalidade: dados.finalidade?.trim() || null,
          resolucaoRecomendada: dados.resolucaoRecomendada?.trim() || null,
          configuracao3D: dados.configuracao3D as
            Prisma.InputJsonValue | undefined,
          componentes: {
            create: componentes.map((item, ordem) => ({
              hardwareId: item.hardwareId,
              categoria: item.categoria,
              quantidade: item.quantidade ?? 1,
              posicao: item.posicao ?? null,
              ordem: item.ordem ?? ordem,
            })),
          },
          // Consumo/fonte recomendada só devem ser apresentados quando uma
          // configuração técnica completa for efetivamente verificada.
        },
        select: { id: true },
      });
    });
    return this.builds.buscarAdmin(criado.id);
  }

  async atualizar(id: number, dados: AtualizarBuildDto) {
    const atual = await this.prisma.build.findUnique({
      where: { id },
      include: { produto: true, _count: { select: { componentes: true } } },
    });
    if (!atual) throw new NotFoundException('PC montado/kit não encontrado.');
    if (dados.componentes !== undefined)
      await this.validarVinculos(dados.componentes);
    const descricao =
      dados.descricao !== undefined ? dados.descricao : atual.produto.descricao;
    const publicado = dados.publicado ?? atual.produto.publicado;
    const totalVinculos = dados.componentes?.length ?? atual._count.componentes;
    this.validarDescricaoParaPublicar(publicado, descricao, totalVinculos);

    const nome = dados.nome?.trim() ?? atual.produto.nome;
    const slug =
      dados.nome !== undefined
        ? await this.slugUnico(nome, atual.produtoId)
        : undefined;
    const categoria =
      dados.categoria !== undefined
        ? await this.categoriaComercial(dados.categoria)
        : null;

    await this.prisma.$transaction(async (tx) => {
      if (dados.componentes !== undefined) {
        await tx.buildComponente.deleteMany({ where: { buildId: id } });
        if (dados.componentes.length > 0) {
          await tx.buildComponente.createMany({
            data: dados.componentes.map((item, ordem) => ({
              buildId: id,
              hardwareId: item.hardwareId,
              categoria: item.categoria,
              quantidade: item.quantidade ?? 1,
              posicao: item.posicao ?? null,
              ordem: item.ordem ?? ordem,
            })),
          });
        }
      }
      await tx.build.update({
        where: { id },
        data: {
          ...(dados.categoria !== undefined && {
            categoria: dados.categoria?.trim() || null,
          }),
          ...(dados.finalidade !== undefined && {
            finalidade: dados.finalidade?.trim() || null,
          }),
          ...(dados.resolucaoRecomendada !== undefined && {
            resolucaoRecomendada: dados.resolucaoRecomendada?.trim() || null,
          }),
          ...(dados.configuracao3D !== undefined && {
            configuracao3D: dados.configuracao3D as Prisma.InputJsonValue,
          }),
          ...(dados.componentes !== undefined && {
            consumoEstimadoWatts: null,
            fonteRecomendadaWatts: null,
          }),
          produto: {
            update: {
              ...(dados.nome !== undefined && { nome }),
              ...(slug !== undefined && { slug }),
              ...(categoria !== null && { categoriaId: categoria.id }),
              ...(dados.marca !== undefined && {
                marca: dados.marca?.trim() || null,
              }),
              ...(dados.modelo !== undefined && {
                modelo: dados.modelo?.trim() || null,
              }),
              ...(dados.descricao !== undefined && {
                descricao: dados.descricao?.trim() || null,
              }),
              ...(dados.imagemUrl !== undefined && {
                imagemUrl: dados.imagemUrl?.trim() || null,
              }),
              ...(dados.imagemHoverUrl !== undefined && {
                imagemHoverUrl: dados.imagemHoverUrl?.trim() || null,
              }),
              ...(dados.publicado !== undefined && {
                publicado: dados.publicado,
              }),
              ...(dados.ativo !== undefined && { ativo: dados.ativo }),
            },
          },
        },
      });
    });
    return this.builds.buscarAdmin(id);
  }

  // "Sem vínculos" não significa que as peças são gratuitas nem conhecidas.
  // Não comparar o preço do PC com R$ 0,00 ou afirmar que todas as peças têm oferta.
  ajustarResumoSemComponentes<
    T extends {
      componentes: { totalLinhas: number };
      precoPecasCompleto: number | null;
      comparacao: unknown;
      componentesSemOferta: unknown[];
    },
  >(resumo: T): T {
    if (resumo.componentes.totalLinhas > 0) return resumo;
    return {
      ...resumo,
      componentes: {
        ...resumo.componentes,
        todosComOferta: false,
      } as T['componentes'],
      precoPecasCompleto: null,
      comparacao: null,
    };
  }
}
