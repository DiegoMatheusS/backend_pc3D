import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AcaoAuditoria } from '../generated/prisma/enums';

export interface RegistrarAuditoriaParams {
  usuarioId?: number | null;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | number | null;
  dadosAntigos?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  ip?: string | null;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra um evento de auditoria de forma não-bloqueante.
   * Falhas no log NÃO propagam erro para o caller.
   */
  async registrar(params: RegistrarAuditoriaParams): Promise<void> {
    try {
      await this.prisma.auditoriaLog.create({
        data: {
          usuarioId: params.usuarioId ?? null,
          acao: params.acao,
          entidade: params.entidade,
          entidadeId:
            params.entidadeId !== undefined && params.entidadeId !== null
              ? String(params.entidadeId)
              : null,
          dadosAntigos: (params.dadosAntigos ?? undefined) as
            Prisma.InputJsonValue | undefined,
          dadosNovos: (params.dadosNovos ?? undefined) as
            Prisma.InputJsonValue | undefined,
          ip: params.ip ?? null,
        },
      });
    } catch (err) {
      // Nunca deixar falha de auditoria derrubar a requisição principal
      this.logger.error('Falha ao registrar log de auditoria', err);
    }
  }

  /**
   * Lista logs de auditoria com filtros opcionais.
   * Apenas ADMIN pode chamar.
   */
  async listar(filtros: {
    acao?: AcaoAuditoria;
    entidade?: string;
    entidadeId?: string;
    usuarioId?: number;
    pagina?: number;
    porPagina?: number;
  }) {
    const pagina = filtros.pagina ?? 1;
    const porPagina = Math.min(filtros.porPagina ?? 50, 200);
    const skip = (pagina - 1) * porPagina;

    const where = {
      ...(filtros.acao ? { acao: filtros.acao } : {}),
      ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
      ...(filtros.entidadeId ? { entidadeId: filtros.entidadeId } : {}),
      ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
    };

    const [total, itens] = await Promise.all([
      this.prisma.auditoriaLog.count({ where }),
      this.prisma.auditoriaLog.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: porPagina,
        select: {
          id: true,
          acao: true,
          entidade: true,
          entidadeId: true,
          dadosAntigos: true,
          dadosNovos: true,
          ip: true,
          criadoEm: true,
          usuario: {
            select: { id: true, nome: true, email: true, papel: true },
          },
        },
      }),
    ]);

    return {
      total,
      pagina,
      porPagina,
      totalPaginas: Math.ceil(total / porPagina),
      itens,
    };
  }
}
