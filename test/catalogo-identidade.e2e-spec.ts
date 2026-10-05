import { ConfigService } from '@nestjs/config';
import { assertCatalogIdentityAvailable } from '../src/common/catalog-identity';
import { GrupoCategoriaProduto } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

describe('identidade do catálogo sob concorrência (PostgreSQL)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const name = `Produto teste concorrente ${suffix}`;
  let prisma: PrismaService;
  let categoriaId: number | undefined;

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
    );
    await prisma.$connect();
    const categoria = await prisma.categoriaProduto.create({
      data: {
        nome: `Teste ${suffix}`,
        slug: `teste-identidade-${suffix}`,
        grupo: GrupoCategoriaProduto.ACESSORIOS,
      },
    });
    categoriaId = categoria.id;
  });

  afterAll(async () => {
    if (categoriaId) {
      await prisma.produto.deleteMany({ where: { categoriaId } });
      await prisma.categoriaProduto.delete({ where: { id: categoriaId } });
    }
    await prisma?.$disconnect();
  });

  it('duas requisições com nomes equivalentes gravam somente um Produto', async () => {
    const create = (nome: string, slug: string) =>
      prisma.$transaction(async (tx) => {
        await assertCatalogIdentityAvailable(tx, { nome });
        return tx.produto.create({
          data: { categoriaId: categoriaId, nome, slug },
        });
      });
    const results = await Promise.allSettled([
      create(name, `identidade-a-${suffix}`),
      create(name.toUpperCase().replaceAll(' ', '-'), `identidade-b-${suffix}`),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(
      rejected?.status === 'rejected' ? (rejected.reason as Error).message : '',
    ).toContain('Já existe o Produto');
    expect(await prisma.produto.count({ where: { categoriaId } })).toBe(1);
  });
});
