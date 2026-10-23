import { Injectable } from '@nestjs/common';
import { PapelUsuario } from '../generated/prisma/enums';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { PrismaService } from '../prisma/prisma.service';

export type UsuarioNotificacaoComunidade = {
  id: number;
  papel: string;
} | null;

@Injectable()
export class ComunidadeNotificacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoesService: NotificacoesService,
  ) {}

  async comentarioCriado(
    buildId: number,
    comentarioId: number,
    autorComentarioId: number,
    comentarioPaiId?: number,
  ): Promise<void> {
    const build = await this.prisma.buildComunidade.findUnique({
      where: { id: buildId },
      select: { id: true, titulo: true, usuarioId: true },
    });
    if (!build) return;

    if (build.usuarioId !== autorComentarioId) {
      await this.notificacoesService.criar({
        usuarioId: build.usuarioId,
        tipo: comentarioPaiId ? 'RESPOSTA_BUILD' : 'COMENTARIO_BUILD',
        titulo: comentarioPaiId
          ? 'Nova resposta na sua build'
          : 'Novo comentário na sua build',
        mensagem: comentarioPaiId
          ? `Alguém respondeu uma conversa na sua build “${build.titulo}”.`
          : `Alguém comentou na sua build “${build.titulo}”.`,
        referenciaTipo: 'BUILD_COMUNIDADE',
        referenciaId: String(build.id),
        chaveDedupe: `comunidade:comentario:${comentarioId}:dono:${build.usuarioId}`,
      });
    }

    if (!comentarioPaiId) return;

    const pai = await this.prisma.comentarioBuild.findUnique({
      where: { id: comentarioPaiId },
      select: { usuarioId: true },
    });

    if (
      pai &&
      pai.usuarioId !== autorComentarioId &&
      pai.usuarioId !== build.usuarioId
    ) {
      await this.notificacoesService.criar({
        usuarioId: pai.usuarioId,
        tipo: 'RESPOSTA_COMENTARIO_BUILD',
        titulo: 'Responderam ao seu comentário',
        mensagem: `Seu comentário na build “${build.titulo}” recebeu uma resposta.`,
        referenciaTipo: 'BUILD_COMUNIDADE',
        referenciaId: String(build.id),
        chaveDedupe: `comunidade:comentario:${comentarioId}:pai:${pai.usuarioId}`,
      });
    }
  }

  async buildAlteradaPorAdmin(
    buildId: number,
    usuario: UsuarioNotificacaoComunidade,
    acao: 'ALTERADA' | 'REMOVIDA',
  ): Promise<void> {
    if (!usuario || usuario.papel !== PapelUsuario.ADMIN) return;

    const build = await this.prisma.buildComunidade.findUnique({
      where: { id: buildId },
      select: { id: true, titulo: true, usuarioId: true, atualizadoEm: true },
    });
    if (!build || build.usuarioId === usuario.id) return;

    const removida = acao === 'REMOVIDA';
    await this.notificacoesService.criar({
      usuarioId: build.usuarioId,
      tipo: removida ? 'BUILD_REMOVIDA_ADMIN' : 'BUILD_ALTERADA_ADMIN',
      titulo: removida
        ? 'Sua publicação foi removida pela administração'
        : 'Sua publicação foi alterada pela administração',
      mensagem: removida
        ? `A publicação “${build.titulo}” foi removida pela administração.`
        : `A publicação “${build.titulo}” recebeu uma alteração da administração.`,
      referenciaTipo: 'BUILD_COMUNIDADE',
      referenciaId: String(build.id),
      chaveDedupe: removida
        ? `comunidade:build:${build.id}:admin:removida`
        : `comunidade:build:${build.id}:admin:alterada:${build.atualizadoEm.getTime()}`,
    });
  }

  async comentarioModeradoPorAdmin(
    comentarioId: number,
    usuario: UsuarioNotificacaoComunidade,
    acao: 'ALTERADO' | 'REMOVIDO',
  ): Promise<void> {
    if (!usuario || usuario.papel !== PapelUsuario.ADMIN) return;

    const comentario = await this.prisma.comentarioBuild.findUnique({
      where: { id: comentarioId },
      select: {
        id: true,
        usuarioId: true,
        atualizadoEm: true,
        build: { select: { id: true, titulo: true } },
      },
    });
    if (!comentario || comentario.usuarioId === usuario.id) return;

    const removido = acao === 'REMOVIDO';
    await this.notificacoesService.criar({
      usuarioId: comentario.usuarioId,
      tipo: removido
        ? 'COMENTARIO_REMOVIDO_ADMIN'
        : 'COMENTARIO_ALTERADO_ADMIN',
      titulo: removido
        ? 'Seu comentário foi removido pela administração'
        : 'Seu comentário foi moderado pela administração',
      mensagem: removido
        ? `Seu comentário na build “${comentario.build.titulo}” foi removido pela administração.`
        : `Seu comentário na build “${comentario.build.titulo}” recebeu uma alteração da administração.`,
      referenciaTipo: 'BUILD_COMUNIDADE',
      referenciaId: String(comentario.build.id),
      chaveDedupe: removido
        ? `comunidade:comentario:${comentario.id}:admin:removido`
        : `comunidade:comentario:${comentario.id}:admin:alterado:${comentario.atualizadoEm.getTime()}`,
    });
  }
}
