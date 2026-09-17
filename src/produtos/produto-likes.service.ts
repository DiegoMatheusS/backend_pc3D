import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ResumoLikeProduto = {
  produtoId: number;
  likesCount: number;
  likedByUser: boolean;
};

@Injectable()
export class ProdutoLikesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizarIds(produtoIds: number[]): number[] {
    const ids = [
      ...new Set(
        produtoIds.filter(
          (id) => Number.isInteger(id) && Number.isSafeInteger(id) && id > 0,
        ),
      ),
    ];

    if (ids.length > 100) {
      throw new BadRequestException(
        'Consulte no máximo 100 produtos por vez para obter os likes.',
      );
    }

    return ids;
  }

  private async garantirProdutoPublico(produtoId: number): Promise<void> {
    const produto = await this.prisma.produto.findFirst({
      where: {
        id: produtoId,
        ativo: true,
        publicado: true,
        categoria: { ativo: true },
      },
      select: { id: true },
    });

    if (!produto) {
      throw new NotFoundException('Produto não encontrado.');
    }
  }

  private async contar(produtoId: number): Promise<number> {
    const linhas = await this.prisma.$queryRaw<Array<{ likesCount: number }>>(
      Prisma.sql`
        SELECT COUNT(DISTINCT "usuario_id")::integer AS "likesCount"
        FROM "produto_likes"
        WHERE "produto_id" = ${produtoId}
      `,
    );

    return Number(linhas[0]?.likesCount ?? 0);
  }

  async resumo(produtoIds: number[], usuarioId?: number | null) {
    const ids = this.normalizarIds(produtoIds);
    if (ids.length === 0) return { itens: [] as ResumoLikeProduto[] };

    const idsSql = Prisma.join(ids.map((id) => Prisma.sql`${id}`));
    const usuarioAtualId =
      Number.isInteger(usuarioId) && Number(usuarioId) > 0
        ? Number(usuarioId)
        : -1;

    const itens = await this.prisma.$queryRaw<ResumoLikeProduto[]>(
      Prisma.sql`
        SELECT
          p."id" AS "produtoId",
          COUNT(DISTINCT pl."usuario_id")::integer AS "likesCount",
          COALESCE(BOOL_OR(pl."usuario_id" = ${usuarioAtualId}), false) AS "likedByUser"
        FROM "produtos" p
        INNER JOIN "categorias_produtos" cp
          ON cp."id" = p."categoria_id" AND cp."ativo" = true
        LEFT JOIN "produto_likes" pl
          ON pl."produto_id" = p."id"
        WHERE
          p."id" IN (${idsSql})
          AND p."ativo" = true
          AND p."publicado" = true
        GROUP BY p."id"
      `,
    );

    const porId = new Map(itens.map((item) => [item.produtoId, item]));
    return {
      itens: ids.map(
        (produtoId): ResumoLikeProduto =>
          porId.get(produtoId) ?? {
            produtoId,
            likesCount: 0,
            likedByUser: false,
          },
      ),
    };
  }

  async curtir(produtoId: number, usuarioId: number) {
    await this.garantirProdutoPublico(produtoId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "produto_likes" ("produto_id", "usuario_id")
        VALUES (${produtoId}, ${usuarioId})
        ON CONFLICT ("produto_id", "usuario_id") DO NOTHING
      `,
    );

    return {
      produtoId,
      likedByUser: true,
      likesCount: await this.contar(produtoId),
    };
  }

  async descurtir(produtoId: number, usuarioId: number) {
    await this.garantirProdutoPublico(produtoId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM "produto_likes"
        WHERE "produto_id" = ${produtoId} AND "usuario_id" = ${usuarioId}
      `,
    );

    return {
      produtoId,
      likedByUser: false,
      likesCount: await this.contar(produtoId),
    };
  }
}
