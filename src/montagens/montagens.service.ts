import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HardwaresService } from '../hardwares/hardwares.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { CriarMontagemDto } from './dtos/criar-montagem.dto';
import { AtualizarMontagemDto } from './dtos/atualizar-montagem.dto';
import { StatusMontagem } from '../generated/prisma/enums';
import { SentidoFluxoAr } from '../hardwares/dtos/verificar-compatibilidade-montagem.dto';

@Injectable()
export class MontagensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hardwaresService: HardwaresService,
    private readonly ofertasService: OfertasService,
  ) {}

  // ── utilidade ────────────────────────────────────────────────────────────
  private criarSlug(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private async criarSlugUnico(base: string): Promise<string> {
    const slug = this.criarSlug(base);
    const existente = await this.prisma.montagem.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existente) return slug;
    const sufixo = Date.now().toString(36);
    return `${slug}-${sufixo}`;
  }

  // ── seleção padrão ────────────────────────────────────────────────────────
  private get selectResumo() {
    return {
      id: true,
      nome: true,
      slug: true,
      descricao: true,
      status: true,
      publico: true,
      criadoEm: true,
      atualizadoEm: true,
      usuario: { select: { id: true, nome: true } },
      gabinete: { select: { id: true, nome: true, categoria: true } },
      fonte: { select: { id: true, nome: true, categoria: true } },
      cooler: { select: { id: true, nome: true, categoria: true } },
      _count: { select: { itens: true } },
    } as const;
  }

  // ── criar ─────────────────────────────────────────────────────────────────
  async criar(usuarioId: number, dados: CriarMontagemDto) {
    // Validar estrutura 3D antes de persistir
    await this.validarEstrutura(dados.gabineteId, dados);

    const slug = await this.criarSlugUnico(dados.nome);

    return this.prisma.$transaction(async (tx) => {
      const montagem = await tx.montagem.create({
        data: {
          usuarioId,
          gabineteId: dados.gabineteId,
          fonteId: dados.fonteId ?? null,
          coolerId: dados.coolerId ?? null,
          nome: dados.nome,
          descricao: dados.descricao ?? null,
          slug,
          publico: dados.publico ?? false,
          status: StatusMontagem.RASCUNHO,
        },
        select: this.selectResumo,
      });

      await tx.itemMontagem.createMany({
        data: dados.itens.map((item, i) => ({
          montagemId: montagem.id,
          instanciaId: item.instanciaId ?? `item-${i + 1}`,
          instanciaPaiId: item.instanciaPaiId ?? null,
          pontoEncaixeId: item.pontoEncaixeId,
          hardwareFilhoId: item.hardwareFilhoId,
        })),
      });

      if (dados.ventoinhas && dados.ventoinhas.length > 0) {
        await tx.ventoinhaConfigMontagem.createMany({
          data: dados.ventoinhas.map((v) => ({
            montagemId: montagem.id,
            instanciaId: v.instanciaId ?? null,
            ventoinhaId: v.ventoinhaId,
            posicao: v.posicao,
            sentido: v.sentido ?? null,
          })),
        });
      }

      // Re-busca para retornar _count correto após os createMany
      return tx.montagem.findUniqueOrThrow({
        where: { id: montagem.id },
        select: this.selectResumo,
      });
    });
  }

  // ── listar minhas montagens ───────────────────────────────────────────────
  async listarMinhas(usuarioId: number) {
    const montagens = await this.prisma.montagem.findMany({
      where: { usuarioId },
      select: this.selectResumo,
      orderBy: { atualizadoEm: 'desc' },
    });

    return { total: montagens.length, montagens };
  }

  // ── listar públicas ───────────────────────────────────────────────────────
  async listarPublicas() {
    const montagens = await this.prisma.montagem.findMany({
      where: { publico: true, status: StatusMontagem.PUBLICADA },
      select: this.selectResumo,
      orderBy: { atualizadoEm: 'desc' },
    });

    return { total: montagens.length, montagens };
  }

  // ── buscar por slug (pública ou própria) ──────────────────────────────────
  async buscarPorSlug(slug: string, usuarioId?: number) {
    const montagem = await this.prisma.montagem.findUnique({
      where: { slug },
      include: {
        usuario: { select: { id: true, nome: true } },
        gabinete: { select: { id: true, nome: true, categoria: true } },
        fonte: { select: { id: true, nome: true, categoria: true } },
        cooler: { select: { id: true, nome: true, categoria: true } },
        itens: {
          select: {
            instanciaId: true,
            instanciaPaiId: true,
            pontoEncaixeId: true,
            hardwareFilho: {
              select: { id: true, nome: true, categoria: true },
            },
          },
        },
        ventoinhas: {
          select: {
            instanciaId: true,
            ventoinhaId: true,
            posicao: true,
            sentido: true,
            ventoinha: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!montagem) {
      throw new NotFoundException('Montagem não encontrada.');
    }

    const eDono = usuarioId === montagem.usuarioId;
    const estaPublicada =
      montagem.publico && montagem.status === StatusMontagem.PUBLICADA;

    if (!eDono && !estaPublicada) {
      throw new ForbiddenException(
        'Esta montagem não está publicada. Apenas o dono pode visualizá-la.',
      );
    }

    return montagem;
  }

  // ── buscar por ID (apenas dono) ───────────────────────────────────────────
  async buscarPorId(id: number, usuarioId: number) {
    const montagem = await this.prisma.montagem.findUnique({
      where: { id },
      include: {
        usuario: { select: { id: true, nome: true } },
        gabinete: { select: { id: true, nome: true, categoria: true } },
        fonte: { select: { id: true, nome: true, categoria: true } },
        cooler: { select: { id: true, nome: true, categoria: true } },
        itens: {
          select: {
            instanciaId: true,
            instanciaPaiId: true,
            pontoEncaixeId: true,
            hardwareFilho: {
              select: { id: true, nome: true, categoria: true },
            },
          },
        },
        ventoinhas: {
          select: {
            instanciaId: true,
            ventoinhaId: true,
            posicao: true,
            sentido: true,
          },
        },
      },
    });

    if (!montagem) {
      throw new NotFoundException('Montagem não encontrada.');
    }

    if (montagem.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar esta montagem.',
      );
    }

    return montagem;
  }

  // ── atualizar ─────────────────────────────────────────────────────────────
  async atualizar(id: number, usuarioId: number, dados: AtualizarMontagemDto) {
    const montagem = await this.prisma.montagem.findUnique({
      where: { id },
      select: {
        usuarioId: true,
        gabineteId: true,
        status: true,
        itens: {
          select: {
            instanciaId: true,
            instanciaPaiId: true,
            pontoEncaixeId: true,
            hardwareFilhoId: true,
          },
        },
      },
    });

    if (!montagem) {
      throw new NotFoundException('Montagem não encontrada.');
    }

    if (montagem.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para editar esta montagem.',
      );
    }

    if (montagem.status === StatusMontagem.ARQUIVADA) {
      throw new BadRequestException(
        'Montagens arquivadas não podem ser editadas.',
      );
    }

    const gabineteId = dados.gabineteId ?? montagem.gabineteId;

    // Revalida a estrutura se os itens OU o gabinete mudarem. Ao trocar
    // apenas o gabinete, usa os itens já salvos para impedir que uma montagem
    // válida no gabinete antigo seja persistida em um gabinete incompatível.
    if (dados.itens !== undefined || dados.gabineteId !== undefined) {
      const itensParaValidar =
        dados.itens ??
        montagem.itens.map((item) => ({
          instanciaId: item.instanciaId,
          instanciaPaiId: item.instanciaPaiId ?? undefined,
          pontoEncaixeId: item.pontoEncaixeId,
          hardwareFilhoId: item.hardwareFilhoId,
        }));

      await this.validarEstrutura(gabineteId, {
        gabineteId,
        itens: itensParaValidar,
        ventoinhas: dados.ventoinhas,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.montagem.update({
        where: { id },
        data: {
          ...(dados.nome !== undefined && { nome: dados.nome }),
          ...(dados.descricao !== undefined && { descricao: dados.descricao }),
          ...(dados.gabineteId !== undefined && {
            gabineteId: dados.gabineteId,
          }),
          ...(dados.fonteId !== undefined && { fonteId: dados.fonteId }),
          ...(dados.coolerId !== undefined && { coolerId: dados.coolerId }),
          ...(dados.publico !== undefined && { publico: dados.publico }),
          ...(dados.status !== undefined && { status: dados.status }),
        },
      });

      // Se itens foram enviados, substitui completamente
      if (dados.itens !== undefined) {
        await tx.itemMontagem.deleteMany({ where: { montagemId: id } });
        await tx.itemMontagem.createMany({
          data: dados.itens.map((item, i) => ({
            montagemId: id,
            instanciaId: item.instanciaId ?? `item-${i + 1}`,
            instanciaPaiId: item.instanciaPaiId ?? null,
            pontoEncaixeId: item.pontoEncaixeId,
            hardwareFilhoId: item.hardwareFilhoId,
          })),
        });
      }

      // Se ventoinhas foram enviadas, substitui completamente
      if (dados.ventoinhas !== undefined) {
        await tx.ventoinhaConfigMontagem.deleteMany({
          where: { montagemId: id },
        });
        if (dados.ventoinhas.length > 0) {
          await tx.ventoinhaConfigMontagem.createMany({
            data: dados.ventoinhas.map((v) => ({
              montagemId: id,
              instanciaId: v.instanciaId ?? null,
              ventoinhaId: v.ventoinhaId,
              posicao: v.posicao,
              sentido: v.sentido ?? null,
            })),
          });
        }
      }

      // Re-busca para retornar _count correto após todos os writes
      return tx.montagem.findUniqueOrThrow({
        where: { id },
        select: this.selectResumo,
      });
    });
  }

  // ── duplicar ──────────────────────────────────────────────────────────────
  async duplicar(id: number, usuarioId: number) {
    const original = await this.prisma.montagem.findUnique({
      where: { id },
      include: {
        itens: true,
        ventoinhas: true,
      },
    });

    if (!original) {
      throw new NotFoundException('Montagem não encontrada.');
    }

    // Pode duplicar se for própria ou se estiver efetivamente publicada.
    const podeAcessar =
      original.usuarioId === usuarioId ||
      (original.publico && original.status === StatusMontagem.PUBLICADA);

    if (!podeAcessar) {
      throw new ForbiddenException(
        'Você não tem permissão para duplicar esta montagem.',
      );
    }

    const slug = await this.criarSlugUnico(`${original.nome}-copia`);

    return this.prisma.$transaction(async (tx) => {
      const nova = await tx.montagem.create({
        data: {
          usuarioId,
          gabineteId: original.gabineteId,
          fonteId: original.fonteId,
          coolerId: original.coolerId,
          nome: `${original.nome} (cópia)`,
          descricao: original.descricao,
          slug,
          publico: false,
          status: StatusMontagem.RASCUNHO,
        },
        select: this.selectResumo,
      });

      if (original.itens.length > 0) {
        await tx.itemMontagem.createMany({
          data: original.itens.map((item) => ({
            montagemId: nova.id,
            instanciaId: item.instanciaId,
            instanciaPaiId: item.instanciaPaiId,
            pontoEncaixeId: item.pontoEncaixeId,
            hardwareFilhoId: item.hardwareFilhoId,
          })),
        });
      }

      if (original.ventoinhas.length > 0) {
        await tx.ventoinhaConfigMontagem.createMany({
          data: original.ventoinhas.map((v) => ({
            montagemId: nova.id,
            instanciaId: v.instanciaId,
            ventoinhaId: v.ventoinhaId,
            posicao: v.posicao,
            sentido: v.sentido,
          })),
        });
      }

      return tx.montagem.findUniqueOrThrow({
        where: { id: nova.id },
        select: this.selectResumo,
      });
    });
  }

  // ── excluir ───────────────────────────────────────────────────────────────
  async excluir(id: number, usuarioId: number) {
    const montagem = await this.prisma.montagem.findUnique({
      where: { id },
      select: { usuarioId: true },
    });

    if (!montagem) {
      throw new NotFoundException('Montagem não encontrada.');
    }

    if (montagem.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir esta montagem.',
      );
    }

    await this.prisma.montagem.delete({ where: { id } });

    return { mensagem: 'Montagem excluída com sucesso.' };
  }

  // ── resolver montagem salva (retorna 3D + compatibilidade) ────────────────
  async resolverMontagem(id: number, usuarioId?: number) {
    const montagem = await this.prisma.montagem.findUnique({
      where: { id },
      include: {
        itens: true,
        ventoinhas: true,
      },
    });

    if (!montagem) {
      throw new NotFoundException('Montagem não encontrada.');
    }

    const podeAcessar =
      montagem.usuarioId === usuarioId ||
      (montagem.publico && montagem.status === StatusMontagem.PUBLICADA);

    if (!podeAcessar) {
      throw new ForbiddenException('Esta montagem não está publicada.');
    }

    const itens = montagem.itens.map((item) => ({
      instanciaId: item.instanciaId,
      instanciaPaiId: item.instanciaPaiId ?? undefined,
      pontoEncaixeId: item.pontoEncaixeId,
      hardwareFilhoId: item.hardwareFilhoId,
    }));

    const ventoinhas = montagem.ventoinhas.map((v) => ({
      instanciaId: v.instanciaId ?? undefined,
      ventoinhaId: v.ventoinhaId,
      posicao: v.posicao,
      sentido: (v.sentido as SentidoFluxoAr) ?? undefined,
    }));

    // Preserva a multiplicidade física dos itens. Duas RAMs/SSDs iguais
    // precisam ser cobradas duas vezes, mesmo compartilhando o mesmo hardwareId.
    const hardwareIds = [
      montagem.gabineteId,
      ...montagem.itens.map((item) => item.hardwareFilhoId),
    ];

    // Fonte e cooler são referências próprias da montagem e podem não existir
    // como ItemMontagem. Evita dupla contagem caso também tenham sido inseridos
    // explicitamente na árvore 3D.
    if (
      montagem.fonteId !== null &&
      !montagem.itens.some((item) => item.hardwareFilhoId === montagem.fonteId)
    ) {
      hardwareIds.push(montagem.fonteId);
    }

    if (
      montagem.coolerId !== null &&
      !montagem.itens.some((item) => item.hardwareFilhoId === montagem.coolerId)
    ) {
      hardwareIds.push(montagem.coolerId);
    }

    const [resultado3D, preco] = await Promise.all([
      montagem.fonteId
        ? this.hardwaresService.resolverMontagemCompleta(montagem.gabineteId, {
            itens,
            fonteId: montagem.fonteId,
            ventoinhas,
            coolerId: montagem.coolerId ?? undefined,
          })
        : this.hardwaresService.resolverMontagem3DPublica(montagem.gabineteId, {
            itens,
          }),
      this.ofertasService.calcularPrecoTotal(hardwareIds),
    ]);

    return { ...resultado3D, preco };
  }

  // ── helper interno: valida estrutura 3D sem persistir ────────────────────
  private async validarEstrutura(
    gabineteId: number,
    dados: {
      gabineteId: number;
      itens: CriarMontagemDto['itens'];
      ventoinhas?: CriarMontagemDto['ventoinhas'];
    },
  ) {
    // Chama resolverMontagem3DPublica apenas para validar (sem salvar)
    await this.hardwaresService.resolverMontagem3DPublica(gabineteId, {
      itens: dados.itens,
    });
  }
}
