import request from 'supertest';
import {
  GrupoCategoriaProduto,
  StatusOferta,
  TipoProduto,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';

describe('Busca de Ofertas — produtos com link afiliado (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let categoriaId: number;
  let parceiroId: number;
  let produtoComAfiliadoId: number;
  let produtoSemAfiliadoId: number;
  let produtoOfertaInicialId: number | null = null;
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);

    const categoria = await prisma.categoriaProduto.create({
      data: {
        nome: `Processadores Busca Ofertas ${sufixo}`,
        slug: `processadores-busca-ofertas-${sufixo}`,
        grupo: GrupoCategoriaProduto.COMPONENTES,
        ativo: true,
      },
    });
    categoriaId = categoria.id;

    const parceiro = await prisma.parceiro.create({
      data: {
        nome: `Mercado parceiro ${sufixo}`,
        slug: `mercado-parceiro-${sufixo}`,
        ativo: true,
        programaAfiliados: true,
      },
    });
    parceiroId = parceiro.id;

    const produtoComAfiliado = await prisma.produto.create({
      data: {
        categoriaId,
        tipo: TipoProduto.GENERICO,
        nome: `Ryzen 7 Busca Ofertas ${sufixo}`,
        slug: `ryzen-7-busca-ofertas-${sufixo}`,
        descricao: 'Processador AM5 para teste da Busca de Ofertas',
        marca: 'AMD',
        publicado: false,
        ativo: true,
      },
    });
    produtoComAfiliadoId = produtoComAfiliado.id;

    const produtoSemAfiliado = await prisma.produto.create({
      data: {
        categoriaId,
        tipo: TipoProduto.GENERICO,
        nome: `Produto sem afiliado ${sufixo}`,
        slug: `produto-sem-afiliado-${sufixo}`,
        publicado: true,
        ativo: true,
      },
    });
    produtoSemAfiliadoId = produtoSemAfiliado.id;

    await prisma.oferta.createMany({
      data: [
        {
          produtoId: produtoComAfiliadoId,
          parceiroId,
          urlOriginal: `https://example.com/original-${sufixo}`,
          urlAfiliada: `https://affiliate.example.com/ryzen-${sufixo}`,
          preco: 800,
          precoAnterior: 1000,
          status: StatusOferta.ATIVA,
          verificadoEm: new Date(),
        },
        {
          produtoId: produtoSemAfiliadoId,
          parceiroId,
          urlOriginal: `https://example.com/sem-afiliado-${sufixo}`,
          preco: 500,
          precoAnterior: 600,
          status: StatusOferta.ATIVA,
          verificadoEm: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    if (prisma) {
      const ids = [
        produtoComAfiliadoId,
        produtoSemAfiliadoId,
        produtoOfertaInicialId,
      ].filter((id): id is number => typeof id === 'number');
      if (ids.length > 0) {
        await prisma.produto.deleteMany({ where: { id: { in: ids } } });
      }
      if (parceiroId) {
        await prisma.parceiro.deleteMany({ where: { id: parceiroId } });
      }
      if (categoriaId) {
        await prisma.categoriaProduto.deleteMany({
          where: { id: categoriaId },
        });
      }
    }
    if (app) await app.close();
  });

  it('exige autenticação para a lista interna', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/admin/busca-ofertas',
    );
    expect(res.status).toBe(401);
  });

  it('lista somente ofertas ativas com link afiliado', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/admin/busca-ofertas?busca=${encodeURIComponent(sufixo)}`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body.origem).toBe('BANCO_CRIABYTE');
    expect(res.body.modo).toBe('PRODUTOS_COM_LINK_AFILIADO');
    expect(res.body.total).toBe(1);
    expect(res.body.ofertas[0]).toMatchObject({
      produtoId: produtoComAfiliadoId,
      tag: 'PROCESSADOR',
      precoAtual: 800,
      precoAnterior: 1000,
      descontoPercentual: 20,
      produtoPublicado: false,
    });
    expect(res.body.ofertas[0].url).toContain('affiliate.example.com');
  });

  it('filtra por desconto e tag', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/busca-ofertas?tag=PROCESSADOR&descontoMinimo=20')
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(
      res.body.ofertas.some(
        (oferta: { produtoId: number }) =>
          oferta.produtoId === produtoComAfiliadoId,
      ),
    ).toBe(true);
  });

  it('status confirma que não existe API externa', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/busca-ofertas/status')
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      origem: 'BANCO_CRIABYTE',
      apiExterna: false,
      modo: 'PRODUTOS_COM_LINK_AFILIADO',
    });
    expect(res.body.totalComLinkAfiliado).toBeGreaterThanOrEqual(1);
  });

  it('Atualizar apenas relê o banco e não cria registros', async () => {
    const antes = await prisma.oferta.count();

    const res = await request(app.getHttpServer())
      .post('/api/admin/busca-ofertas/atualizar')
      .set('Cookie', cookieAdmin);

    const depois = await prisma.oferta.count();
    expect(res.status).toBe(200);
    expect(res.body.atualizacaoExecutada).toBe(true);
    expect(res.body.origem).toBe('BANCO_CRIABYTE');
    expect(depois).toBe(antes);
  });

  it('não deixa Produto órfão quando a oferta inicial falha', async () => {
    const nome = `Produto rollback oferta inicial ${Date.now()}`;
    const criar = await request(app.getHttpServer())
      .post('/api/admin/produtos')
      .set('Cookie', cookieAdmin)
      .send({
        categoriaId,
        nome,
        publicado: false,
        ativo: true,
        ofertaInicial: {
          parceiroId: 2_147_483_647,
          urlOriginal: 'https://example.com/oferta-invalida',
          urlAfiliada: 'https://affiliate.example.com/oferta-invalida',
          preco: 100,
        },
      });

    expect(criar.status).toBe(404);
    const produto = await prisma.produto.findFirst({ where: { nome } });
    expect(produto).toBeNull();
  });

  it('cria Produto + Oferta afiliada na mesma transação e já aparece na Busca de Ofertas', async () => {
    const nome = 'Ryzen Oferta Inicial Produto E2E';
    const criar = await request(app.getHttpServer())
      .post('/api/admin/produtos')
      .set('Cookie', cookieAdmin)
      .send({
        categoriaId,
        nome,
        marca: 'AMD E2E Inicial',
        modelo: `MODEL-${Date.now()}`,
        publicado: true,
        ativo: true,
        ofertaInicial: {
          parceiroId,
          urlOriginal: `https://example.com/produto-oferta-inicial-${Date.now()}`,
          urlAfiliada: `https://affiliate.example.com/produto-oferta-inicial-${Date.now()}`,
          preco: 900,
          precoAnterior: 1200,
        },
      });

    expect(criar.status).toBe(201);
    produtoOfertaInicialId = (criar.body as { id: number }).id;
    expect(criar.body.ofertas).toHaveLength(1);
    expect(criar.body.ofertas[0]).toMatchObject({
      produtoId: produtoOfertaInicialId,
      parceiroId,
    });
    expect(criar.body.ofertas[0].urlAfiliada).toContain(
      'affiliate.example.com',
    );

    const busca = await request(app.getHttpServer())
      .get(`/api/admin/busca-ofertas?busca=${encodeURIComponent(nome)}`)
      .set('Cookie', cookieAdmin);

    expect(busca.status).toBe(200);
    expect(busca.body.total).toBe(1);
    expect(busca.body.ofertas[0]).toMatchObject({
      produtoId: produtoOfertaInicialId,
      precoAtual: 900,
      precoAnterior: 1200,
      descontoPercentual: 25,
    });
  });
});
