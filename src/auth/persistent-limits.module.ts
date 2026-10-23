import { Global, Injectable, Module } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PersistentLimits implements ThrottlerStorage {
  constructor(private readonly prisma: PrismaService) {}
  hash(key: string) {
    return createHash('sha256').update(key).digest('hex');
  }
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ) {
    const digest = this.hash(key);
    const rows = await this.prisma.$queryRaw<
      Array<{
        total: number;
        expire: number;
        blocked: boolean;
        remaining: number;
      }>
    >`
      INSERT INTO limites_requisicao (chave,total,expira_em,bloqueado_ate)
      VALUES (${digest},1,NOW()+${ttl}*INTERVAL '1 millisecond',NULL)
      ON CONFLICT (chave) DO UPDATE SET
        total=CASE WHEN limites_requisicao.expira_em<=NOW() THEN 1 ELSE limites_requisicao.total+1 END,
        expira_em=CASE WHEN limites_requisicao.expira_em<=NOW() THEN NOW()+${ttl}*INTERVAL '1 millisecond' ELSE limites_requisicao.expira_em END,
        bloqueado_ate=CASE WHEN limites_requisicao.bloqueado_ate>NOW() THEN limites_requisicao.bloqueado_ate
          WHEN limites_requisicao.expira_em>NOW() AND limites_requisicao.total+1>${limit}
          THEN NOW()+${blockDuration}*INTERVAL '1 millisecond' ELSE NULL END
      RETURNING total,
        GREATEST(0,CEIL(EXTRACT(EPOCH FROM (expira_em-NOW()))))::int AS expire,
        COALESCE(bloqueado_ate>NOW(),false) AS blocked,
        GREATEST(0,CEIL(EXTRACT(EPOCH FROM (bloqueado_ate-NOW()))))::int AS remaining`;
    const row = rows[0];
    return {
      totalHits: row.total,
      timeToExpire: row.expire,
      isBlocked: row.blocked,
      timeToBlockExpire: row.remaining,
    };
  }
  async blocked(key: string) {
    const digest = this.hash(key);
    const rows = await this.prisma.$queryRaw<
      Array<{ blocked: boolean }>
    >`SELECT COALESCE(bool_or(bloqueado_ate>NOW()),false) AS blocked FROM limites_requisicao WHERE chave=${digest}`;
    return rows[0].blocked;
  }
  async clear(key: string) {
    await this.prisma.limiteRequisicao.deleteMany({
      where: { chave: this.hash(key) },
    });
  }
}

@Global()
@Module({
  imports: [PrismaModule],
  providers: [PersistentLimits],
  exports: [PersistentLimits],
})
export class PersistentLimitsModule {}
