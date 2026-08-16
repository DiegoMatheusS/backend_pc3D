import request from 'supertest';
import { App, criarApp, loginAdmin } from './app-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Loja, notebooks e validações administrativas (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  const produtoIds: number[] = [];
  const notebookIds: number[] = [];
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);
  });

  afterAll(async () => {
    if (notebookIds.length > 0) {
      await prisma.notebook.deleteMany({ where: { id: { in: notebookIds } } });
    }
    if (produtoIds.length > 0) {
      await prisma.produto.deleteMany({ where: { id: { in: produtoIds } } });
    }
    await app.close();
  });

  it('rejeita faixa de preço invertida no catálogo de produtos', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/produtos?precoMin=5000&precoMax=1000',
    );
    expect(res.status).toBe(400);
  });

  it('rejeita faixa de preço invertida no catálogo de notebooks', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/notebooks?precoMin=5000&precoMax=1000',
    );
    expect(res.status).toBe(400);
  });

  it('produto periférico publicado exige especificação da categoria', async () => {
    const categoria = await prisma.categoriaProduto.findUnique({
      where: { slug: 'monitores' },
      select: { id: true },
    });
    expect(categoria).not.toBeNull();

    const res = await request(app.getHttpServer())
      .post('/api/admin/produtos')
      .set('Cookie', cookieAdmin)
      .send({
        categoriaId: categoria.id,
        nome: `Monitor sem especificação ${sufixo}`,
        marca: 'E2E',
        modelo: `MON-${sufixo}`,
        publicado: true,
      });

    expect(res.status).toBe(400);
  });

  it('permite limpar campos opcionais e publicar após adicionar especificação', async () => {
    const categoria = await prisma.categoriaProduto.findUnique({
      where: { slug: 'monitores' },
      select: { id: true },
    });
    expect(categoria).not.toBeNull();

    const criar = await request(app.getHttpServer())
      .post('/api/admin/produtos')
      .set('Cookie', cookieAdmin)
      .send({
        categoriaId: categoria.id,
        nome: `Monitor E2E ${sufixo}`,
        marca: 'Marca E2E',
        modelo: `M-${sufixo}`,
        descricao: 'Descrição temporária',
        imagemUrl: 'https://example.com/monitor.png',
        publicado: false,
      });
    expect(criar.status).toBe(201);
    produtoIds.push(criar.body.id as number);

    const atualizar = await request(app.getHttpServer())
      .patch(`/api/admin/produtos/${criar.body.id}`)
      .set('Cookie', cookieAdmin)
      .send({
        descricao: null,
        imagemUrl: null,
        mpn: null,
        gtin: null,
        especificacaoMonitor: {
          tamanhoPolegadas: 27,
          taxaAtualizacaoHz: 165,
          resolucao: '2560x1440',
        },
        publicado: true,
      });

    expect(atualizar.status).toBe(200);
    expect(atualizar.body.descricao).toBeNull();
    expect(atualizar.body.imagemUrl).toBeNull();
    expect(atualizar.body.publicado).toBe(true);
    expect(atualizar.body.especificacaoMonitor).not.toBeNull();
  });

  it('não aceita null em campos booleanos do produto', async () => {
    const produtoId = produtoIds[0];
    expect(produtoId).toBeDefined();

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/produtos/${produtoId}`)
      .set('Cookie', cookieAdmin)
      .send({ publicado: null });

    expect(res.status).toBe(400);
  });

  it('notebook permite limpar campos opcionais sem erro 500', async () => {
    const criar = await request(app.getHttpServer())
      .post('/api/admin/notebooks')
      .set('Cookie', cookieAdmin)
      .send({
        nome: `Notebook E2E ${sufixo}`,
        marca: 'Marca E2E',
        modelo: `NB-${sufixo}`,
        descricao: 'Descrição temporária',
        imagemUrl: 'https://example.com/notebook.png',
        publicado: false,
        especificacao: {
          processadorNome: 'CPU E2E',
          ramInstaladaGb: 16,
          armazenamentoGb: 512,
        },
      });

    expect(criar.status).toBe(201);
    notebookIds.push(criar.body.id as number);
    produtoIds.push(criar.body.produtoId as number);

    const atualizar = await request(app.getHttpServer())
      .patch(`/api/admin/notebooks/${criar.body.id}`)
      .set('Cookie', cookieAdmin)
      .send({
        descricao: null,
        imagemUrl: null,
        imagemHoverUrl: null,
        mpn: null,
        gtin: null,
      });

    expect(atualizar.status).toBe(200);
    expect(atualizar.body.produto.descricao).toBeNull();
    expect(atualizar.body.produto.imagemUrl).toBeNull();
  });

  it('não aceita null em campos booleanos do notebook', async () => {
    const notebookId = notebookIds[0];
    expect(notebookId).toBeDefined();

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/notebooks/${notebookId}`)
      .set('Cookie', cookieAdmin)
      .send({ ativo: null });

    expect(res.status).toBe(400);
  });

  it('valida os filtros da auditoria antes de consultar o Prisma', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/auditoria?acao=ACAO_QUE_NAO_EXISTE&porPagina=999')
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(400);
  });
});
