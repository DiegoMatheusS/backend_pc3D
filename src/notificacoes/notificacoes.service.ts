import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type BancoNotificacao = Prisma.TransactionClient | PrismaService;

export type CriarNotificacaoInput = {
  usuarioId: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  referenciaTipo?: string | null;
  referenciaId?: string | null;
  chaveDedupe?: string | null;
};

@Injectable()
export class NotificacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(
    dados: CriarNotificacaoInput,
    banco: BancoNotificacao = this.prisma,
  ) {
    const create = {
      usuarioId: dados.usuarioId,
      tipo: dados.tipo.trim(),
      titulo: dados.titulo.trim(),
      mensagem: dados.mensagem.trim(),
      referenciaTipo: dados.referenciaTipo?.trim() || null,
      referenciaId: dados.referenciaId?.trim() || null,
      chaveDedupe: dados.chaveDedupe?.trim() || null,
    };

    if (create.chaveDedupe) {
      return banco.notificacao.upsert({
        where: { chaveDedupe: create.chaveDedupe },
        update: {},
        create,
      });
    }

    return banco.notificacao.create({ data: create });
  }

  async listar(usuarioId: number, limiteInformado?: number) {
    const limite = Math.min(Math.max(limiteInformado ?? 30, 1), 100);
    const [naoLidas, notificacoes] = await Promise.all([
      this.prisma.notificacao.count({
        where: { usuarioId, lida: false },
      }),
      this.prisma.notificacao.findMany({
        where: { usuarioId },
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        take: limite,
      }),
    ]);

    return {
      naoLidas,
      totalRetornado: notificacoes.length,
      notificacoes,
    };
  }

  async resumo(usuarioId: number) {
    const [naoLidas, ultima] = await Promise.all([
      this.prisma.notificacao.count({ where: { usuarioId, lida: false } }),
      this.prisma.notificacao.findFirst({
        where: { usuarioId },
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          tipo: true,
          titulo: true,
          criadoEm: true,
          lida: true,
        },
      }),
    ]);

    return { naoLidas, ultima };
  }

  async marcarComoLida(usuarioId: number, id: number) {
    const resultado = await this.prisma.notificacao.updateMany({
      where: { id, usuarioId },
      data: { lida: true, lidaEm: new Date() },
    });

    if (resultado.count === 0) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    return this.prisma.notificacao.findUnique({ where: { id } });
  }

  async marcarTodasComoLidas(usuarioId: number) {
    const agora = new Date();
    const resultado = await this.prisma.notificacao.updateMany({
      where: { usuarioId, lida: false },
      data: { lida: true, lidaEm: agora },
    });

    return { atualizadas: resultado.count, lidaEm: agora };
  }
}
