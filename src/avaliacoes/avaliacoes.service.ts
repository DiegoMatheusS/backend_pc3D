import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusAvaliacao } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarAvaliacaoDto } from './dtos/atualizar-avaliacao.dto';
import { CriarAvaliacaoDto } from './dtos/criar-avaliacao.dto';
import { FiltrarAvaliacoesDto } from './dtos/filtrar-avaliacoes.dto';

@Injectable()
export class AvaliacoesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizarComentario(comentario: string): string {
    const texto = comentario.trim();

    if (/<[^>]+>/.test(texto)) {
      throw new BadRequestException(
        'Comentários devem conter somente texto, sem HTML.',
      );
    }

    return texto;
  }

  private async garantirProdutoPublico(produtoId: number) {
    const produto = await this.prisma.produto.findFirst({
      where: { id: produtoId, ativo: true, publicado: true },
      select: { id: true },
    });
    if (!produto) throw new NotFoundException('Produto não encontrado.');
  }

  async listar(produtoId: number, filtros: FiltrarAvaliacoesDto) {
    await this.garantirProdutoPublico(produtoId);
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 10;
    const where = { produtoId, status: StatusAvaliacao.PUBLICADA };

    const [total, dados, resumo, distribuicao] = await Promise.all([
      this.prisma.avaliacao.count({ where }),
      this.prisma.avaliacao.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          nota: true,
          titulo: true,
          comentario: true,
          criadoEm: true,
          atualizadoEm: true,
          usuario: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.avaliacao.aggregate({
        where,
        _avg: { nota: true },
        _count: { _all: true },
      }),
      this.prisma.avaliacao.groupBy({
        by: ['nota'],
        where,
        _count: { _all: true },
        orderBy: { nota: 'desc' },
      }),
    ]);

    return {
      dados,
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
      avaliacao: {
        media: resumo._avg.nota ?? 0,
        quantidade: resumo._count._all,
        distribuicao: {
          5: distribuicao.find((item) => item.nota === 5)?._count._all ?? 0,
          4: distribuicao.find((item) => item.nota === 4)?._count._all ?? 0,
          3: distribuicao.find((item) => item.nota === 3)?._count._all ?? 0,
          2: distribuicao.find((item) => item.nota === 2)?._count._all ?? 0,
          1: distribuicao.find((item) => item.nota === 1)?._count._all ?? 0,
        },
      },
    };
  }

  async criarOuAtualizar(
    produtoId: number,
    usuarioId: number,
    dados: CriarAvaliacaoDto,
  ) {
    await this.garantirProdutoPublico(produtoId);
    return this.prisma.avaliacao.upsert({
      where: { usuarioId_produtoId: { usuarioId, produtoId } },
      create: {
        usuarioId,
        produtoId,
        nota: dados.nota,
        titulo: dados.titulo?.trim() ?? null,
        comentario: this.normalizarComentario(dados.comentario),
        status: StatusAvaliacao.PUBLICADA,
      },
      update: {
        nota: dados.nota,
        titulo: dados.titulo?.trim() ?? null,
        comentario: this.normalizarComentario(dados.comentario),
        status: StatusAvaliacao.PUBLICADA,
      },
      select: {
        id: true,
        nota: true,
        titulo: true,
        comentario: true,
        status: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  async atualizar(id: number, usuarioId: number, dados: AtualizarAvaliacaoDto) {
    const avaliacao = await this.prisma.avaliacao.findUnique({
      where: { id },
      select: { id: true, usuarioId: true },
    });
    if (!avaliacao) throw new NotFoundException('Avaliação não encontrada.');
    if (avaliacao.usuarioId !== usuarioId) {
      throw new ForbiddenException('Você só pode editar a própria avaliação.');
    }

    return this.prisma.avaliacao.update({
      where: { id },
      data: {
        ...(dados.nota !== undefined && { nota: dados.nota }),
        ...(dados.titulo !== undefined && {
          titulo: dados.titulo.trim() || null,
        }),
        ...(dados.comentario !== undefined && {
          comentario: this.normalizarComentario(dados.comentario),
        }),
        status: StatusAvaliacao.PUBLICADA,
      },
    });
  }

  async excluir(id: number, usuarioId: number) {
    const avaliacao = await this.prisma.avaliacao.findUnique({
      where: { id },
      select: { id: true, usuarioId: true },
    });
    if (!avaliacao) throw new NotFoundException('Avaliação não encontrada.');
    if (avaliacao.usuarioId !== usuarioId) {
      throw new ForbiddenException('Você só pode excluir a própria avaliação.');
    }

    await this.prisma.avaliacao.update({
      where: { id },
      data: { status: StatusAvaliacao.REMOVIDA },
    });
    return { mensagem: 'Avaliação removida com sucesso.' };
  }

  async moderar(id: number, status: StatusAvaliacao) {
    const avaliacao = await this.prisma.avaliacao.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!avaliacao) throw new NotFoundException('Avaliação não encontrada.');
    return this.prisma.avaliacao.update({ where: { id }, data: { status } });
  }

  async produtoIdPorHardware(hardwareId: number) {
    const hardware = await this.prisma.hardware.findUnique({
      where: { id: hardwareId },
      select: { produtoId: true },
    });
    if (!hardware?.produtoId) {
      throw new NotFoundException('Produto do hardware não encontrado.');
    }
    return hardware.produtoId;
  }

  async produtoIdPorNotebook(notebookId: number) {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id: notebookId },
      select: { produtoId: true },
    });
    if (!notebook) throw new NotFoundException('Notebook não encontrado.');
    return notebook.produtoId;
  }

  async produtoIdPorBuild(buildId: number) {
    const build = await this.prisma.build.findUnique({
      where: { id: buildId },
      select: { produtoId: true },
    });
    if (!build) throw new NotFoundException('PC montado não encontrado.');
    return build.produtoId;
  }
}
