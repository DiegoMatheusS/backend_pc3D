import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';
import {
  componentesBuildFixture,
  criarFixturePcCompleto,
  FixturePcCompleto,
  limparFixturePcCompleto,
} from './fixtures/pc-completo.fixture';

describe('Builds comerciais — ciclo de vida administrativo (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let fixture: FixturePcCompleto;
  let buildId = 0;
  let produtoBuildId = 0;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);
    fixture = await criarFixturePcCompleto(prisma);
  });

  afterAll(async () => {
    if (prisma && produtoBuildId) {
      await prisma.produto.deleteMany({ where: { id: produtoBuildId } });
    }
    if (prisma && fixture) {
      await limparFixturePcCompleto(prisma, fixture);
    }
    if (app) await app.close();
  });

  it('cria rascunho, publica, limpa opcionais, despublica e arquiva sem perder o registro administrativo', async () => {
    const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const criar = await request(app.getHttpServer())
      .post('/api/admin/builds')
      .set('Cookie', cookieAdmin)
      .send({
        nome: `Build comercial CRUD E2E ${sufixo}`,
        marca: 'CriaByte Testes',
        modelo: `BUILD-${sufixo}`,
        descricao: 'Descrição temporária',
        imagemUrl: 'https://example.test/build.jpg',
        imagemHoverUrl: 'https://example.test/build-hover.jpg',
        categoria: 'Gamer',
        finalidade: 'Jogos',
        resolucaoRecomendada: '1440p',
        publicado: false,
        ativo: true,
        componentes: componentesBuildFixture(fixture),
      });

    expect(criar.status).toBe(201);
    buildId = (criar.body as { id: number }).id;
    produtoBuildId = (criar.body as { produtoId: number }).produtoId;
    expect(criar.body.produto).toMatchObject({
      publicado: false,
      ativo: true,
    });

    const publicoEnquantoRascunho = await request(app.getHttpServer()).get(
      `/api/builds/${buildId}`,
    );
    expect(publicoEnquantoRascunho.status).toBe(404);

    const publicar = await request(app.getHttpServer())
      .patch(`/api/admin/builds/${buildId}`)
      .set('Cookie', cookieAdmin)
      .send({ publicado: true });

    expect(publicar.status).toBe(200);
    expect(publicar.body.produto.publicado).toBe(true);

    const publico = await request(app.getHttpServer()).get(
      `/api/builds/${buildId}`,
    );
    expect(publico.status).toBe(200);
    expect(publico.body.id).toBe(buildId);

    const limparOpcionais = await request(app.getHttpServer())
      .patch(`/api/admin/builds/${buildId}`)
      .set('Cookie', cookieAdmin)
      .send({
        marca: null,
        modelo: null,
        descricao: null,
        imagemUrl: null,
        imagemHoverUrl: null,
        categoria: null,
        finalidade: null,
        resolucaoRecomendada: null,
      });

    expect(limparOpcionais.status).toBe(200);
    expect(limparOpcionais.body).toMatchObject({
      categoria: null,
      finalidade: null,
      resolucaoRecomendada: null,
    });
    expect(limparOpcionais.body.produto).toMatchObject({
      marca: null,
      modelo: null,
      descricao: null,
      imagemUrl: null,
      imagemHoverUrl: null,
    });

    const booleanoNulo = await request(app.getHttpServer())
      .patch(`/api/admin/builds/${buildId}`)
      .set('Cookie', cookieAdmin)
      .send({ publicado: null });
    expect(booleanoNulo.status).toBe(400);

    const componentesNulos = await request(app.getHttpServer())
      .patch(`/api/admin/builds/${buildId}`)
      .set('Cookie', cookieAdmin)
      .send({ componentes: null });
    expect(componentesNulos.status).toBe(400);

    const despublicar = await request(app.getHttpServer())
      .patch(`/api/admin/builds/${buildId}`)
      .set('Cookie', cookieAdmin)
      .send({ publicado: false });
    expect(despublicar.status).toBe(200);

    const publicoDepoisDespublicar = await request(app.getHttpServer()).get(
      `/api/builds/${buildId}`,
    );
    expect(publicoDepoisDespublicar.status).toBe(404);

    const republicar = await request(app.getHttpServer())
      .patch(`/api/admin/builds/${buildId}`)
      .set('Cookie', cookieAdmin)
      .send({ publicado: true, ativo: true });
    expect(republicar.status).toBe(200);

    const arquivar = await request(app.getHttpServer())
      .delete(`/api/admin/builds/${buildId}`)
      .set('Cookie', cookieAdmin);
    expect(arquivar.status).toBe(200);
    expect(arquivar.body.mensagem).toMatch(/arquivado/i);

    const publicoDepoisArquivar = await request(app.getHttpServer()).get(
      `/api/builds/${buildId}`,
    );
    expect(publicoDepoisArquivar.status).toBe(404);

    const adminDepoisArquivar = await request(app.getHttpServer())
      .get(`/api/admin/builds/${buildId}`)
      .set('Cookie', cookieAdmin);
    expect(adminDepoisArquivar.status).toBe(200);
    expect(adminDepoisArquivar.body.produto).toMatchObject({
      ativo: false,
      publicado: false,
    });
  });
});
