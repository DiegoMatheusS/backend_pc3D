import request from 'supertest';
import {
  GrupoCategoriaProduto,
  StatusOferta,
  TipoProduto,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp } from './app-setup';

describe('Ofertas e destaques (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const produtoIds: number[] = [];
  const parceiroIds: number[] = [];

  async function categoriaId(slug: string): Promise<number> {
    const categoria = await prisma.categoriaProduto.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!categoria) {
      throw new Error(`Categoria obrigatória não encontrada: ${slug}`);
    }
    return categoria.id;
  }

  async function criarProduto(
    slugCategoria: string,
    tipo: TipoProduto,
    nome: string,
  ) {
    const produto = await prisma.produto.create({
      data: {
        categoriaId: await categoriaId(slugCategoria),
        tipo,
        nome,
        slug: `${nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sufixo}`,
        marca: 'Teste E2E',
        publicado: true,
        ativo: true,
      },
    });
    produtoIds.push(produto.id);
    return produto;
  }

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);

    const [parceiroA, parceiroB] = await Promise.all([
      prisma.parceiro.create({
        data: {
          nome: `Parceiro E2E A ${sufixo}`,
          slug: `parceiro-e2e-a-${sufixo}`,
          ativo: true,
          programaAfiliados: true,
        },
      }),
      prisma.parceiro.create({
        data: {
          nome: `Marketplace E2E B ${sufixo}`,
          slug: `marketplace-e2e-b-${sufixo}`,
          ativo: true,
          programaAfiliados: true,
        },
      }),
    ]);
    parceiroIds.push(parceiroA.id, parceiroB.id);

    const hardware = await criarProduto(
      'processadores',
      TipoProduto.HARDWARE,
      `CPU E2E ${sufixo}`,
    );
    const periferico = await criarProduto(
      'mouses',
      TipoProduto.GENERICO,
      `Mouse E2E ${sufixo}`,
    );
    const monitor = await criarProduto(
      'monitores',
      TipoProduto.GENERICO,
      `Monitor E2E ${sufixo}`,
    );
    const notebook = await criarProduto(
      'notebooks',
      TipoProduto.NOTEBOOK,
      `Notebook E2E ${sufixo}`,
    );
    const setup = await criarProduto(
      'mousepads',
      TipoProduto.GENERICO,
      `Setup E2E ${sufixo}`,
    );

    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.oferta.createMany({
      data: [
        {
          produtoId: hardware.id,
          parceiroId: parceiroA.id,
          vendedorNome: 'Loja Oficial A',
          urlOriginal: `https://example.com/oferta-a-${sufixo}`,
          preco: 899,
          precoAnterior: 999,
          status: StatusOferta.ATIVA,
          validoAte: amanha,
          verificadoEm: new Date(),
        },
        {
          produtoId: hardware.id,
          parceiroId: parceiroB.id,
          vendedorNome: 'Loja Marketplace XPTO',
          vendedorIdentificador: `seller-${sufixo}`,
          urlOriginal: `https://example.com/oferta-b-${sufixo}`,
          urlAfiliada: `https://afiliado.example.com/oferta-b-${sufixo}`,
          preco: 849,
          precoAnterior: 999,
          status: StatusOferta.ATIVA,
          validoAte: amanha,
          verificadoEm: new Date(),
        },
        {
          produtoId: hardware.id,
          parceiroId: parceiroA.id,
          urlOriginal: `https://example.com/oferta-inativa-${sufixo}`,
          preco: 100,
          status: StatusOferta.INDISPONIVEL,
          validoAte: amanha,
          verificadoEm: new Date(),
        },
        {
          produtoId: hardware.id,
          parceiroId: parceiroB.id,
          urlOriginal: `https://example.com/oferta-expirada-${sufixo}`,
          preco: 50,
          status: StatusOferta.ATIVA,
          validoAte: ontem,
          verificadoEm: new Date(),
        },
        {
          produtoId: periferico.id,
          parceiroId: parceiroA.id,
          urlOriginal: `https://example.com/mouse-${sufixo}`,
          preco: 199,
          precoAnterior: 249,
          status: StatusOferta.ATIVA,
          verificadoEm: new Date(),
        },
        {
          produtoId: monitor.id,
          parceiroId: parceiroA.id,
          urlOriginal: `https://example.com/monitor-${sufixo}`,
          preco: 1299,
          precoAnterior: 1499,
          status: StatusOferta.ATIVA,
          verificadoEm: new Date(),
        },
        {
          produtoId: notebook.id,
          parceiroId: parceiroA.id,
          urlOriginal: `https://example.com/notebook-${sufixo}`,
          preco: 3999,
          precoAnterior: 4499,
          status: StatusOferta.ATIVA,
          verificadoEm: new Date(),
        },
        {
          produtoId: setup.id,
          parceiroId: parceiroA.id,
          urlOriginal: `https://example.com/setup-${sufixo}`,
          preco: 89,
          precoAnterior: null,
          status: StatusOferta.ATIVA,
          verificadoEm: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    if (prisma) {
      if (produtoIds.length > 0) {
        await prisma.produto.deleteMany({ where: { id: { in: produtoIds } } });
      }
      if (parceiroIds.length > 0) {
        await prisma.parceiro.deleteMany({
          where: { id: { in: parceiroIds } },
        });
      }
    }
    if (app) await app.close();
  });

  it('considera apenas ofertas ativas e não expiradas e escolhe o menor preço', async () => {
    const hardwareId = produtoIds[0];
    const res = await request(app.getHttpServer()).get(
      `/api/ofertas/produto/${hardwareId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.quantidadeOfertasAtivas).toBe(2);
    expect(res.body.total).toBe(2);
    expect(res.body.melhorOferta.precoAtual).toBe(849);
    expect(res.body.melhorOferta.vendedorNome).toBe('Loja Marketplace XPTO');
    expect(res.body.melhorOferta.vendedorIdentificador).toBe(
      `seller-${sufixo}`,
    );
    expect(res.body.melhorOferta.percentualDesconto).toBe(15.02);
    expect(res.body.melhorOferta.urlCompra).toContain('afiliado.example.com');
    expect(
      res.body.ofertas.map(
        (oferta: { precoAtual: number }) => oferta.precoAtual,
      ),
    ).toEqual([849, 899]);
  });

  it('não inventa desconto quando não existe preço anterior confiável', async () => {
    const setupId = produtoIds[4];
    const res = await request(app.getHttpServer()).get(
      `/api/ofertas/produto/${setupId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.melhorOferta.precoAtual).toBe(89);
    expect(res.body.melhorOferta.percentualDesconto).toBeNull();
  });

  it('GET /api/ofertas/destaques separa os cinco grupos comerciais', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/ofertas/destaques',
    );

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['perifericos', 'hardwares', 'monitores', 'notebooks', 'setup'].sort(),
    );

    const encontrar = (grupo: string, produtoId: number) =>
      res.body[grupo].find(
        (item: { produtoId: number }) => item.produtoId === produtoId,
      );

    const hardware = encontrar('hardwares', produtoIds[0]);
    const periferico = encontrar('perifericos', produtoIds[1]);
    const monitor = encontrar('monitores', produtoIds[2]);
    const notebook = encontrar('notebooks', produtoIds[3]);
    const setup = encontrar('setup', produtoIds[4]);

    expect(hardware.grupo).toBe('HARDWARE');
    expect(hardware.melhorPreco).toBe(849);
    expect(hardware.quantidadeOfertas).toBe(2);
    expect(hardware.melhorOferta.vendedorNome).toBe('Loja Marketplace XPTO');
    expect(periferico.grupo).toBe('PERIFERICOS');
    expect(monitor.grupo).toBe('MONITORES');
    expect(notebook.grupo).toBe('NOTEBOOKS');
    expect(setup.grupo).toBe('SETUP');
    expect(setup.percentualDesconto).toBeNull();
  });

  it('mantém os grupos de categoria existentes sem criar enum novo no banco', async () => {
    const grupos = await prisma.categoriaProduto.groupBy({
      by: ['grupo'],
    });
    const existentes = new Set(grupos.map((item) => item.grupo));

    expect(existentes.has(GrupoCategoriaProduto.COMPONENTES)).toBe(true);
    expect(existentes.has(GrupoCategoriaProduto.PERIFERICOS)).toBe(true);
    expect(existentes.has(GrupoCategoriaProduto.SETUP)).toBe(true);
  });
});
