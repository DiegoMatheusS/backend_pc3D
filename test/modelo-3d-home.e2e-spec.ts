import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';
import {
  criarFixturePcCompleto,
  FixturePcCompleto,
  limparFixturePcCompleto,
} from './fixtures/pc-completo.fixture';

describe('Modelo 3D da Home (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let fixture: FixturePcCompleto;
  let segundoModeloGpuId = 0;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);
    fixture = await criarFixturePcCompleto(prisma);
  });

  afterAll(async () => {
    if (prisma && fixture) {
      await limparFixturePcCompleto(prisma, fixture);
    }
    if (app) await app.close();
  });

  it('permite selecionar e trocar o modelo exibido na Home', async () => {
    const primeiroModeloGpuId = fixture.modelos3D.placaVideoId;

    const selecionarPrimeiro = await request(app.getHttpServer())
      .patch(
        `/api/admin/hardwares/modelos-3d/${primeiroModeloGpuId}/mostrar-no-home`,
      )
      .set('Cookie', cookieAdmin)
      .send({ mostrarNoHome: true });

    expect(selecionarPrimeiro.status).toBe(200);
    expect(selecionarPrimeiro.body).toMatchObject({
      id: primeiroModeloGpuId,
      mostrarNoHome: true,
    });

    const criarSegundo = await request(app.getHttpServer())
      .post(`/api/admin/hardwares/${fixture.hardwares.placaVideoId}/modelos-3d`)
      .set('Cookie', cookieAdmin)
      .send({
        nome: 'Segundo modelo GPU Home E2E',
        arquivoUrl: 'https://cdn.example.test/modelos/gpu-home-2.glb',
        formato: 'GLB',
        origem: 'EXTERNO',
        fonteUrl: 'https://example.test/modelos/gpu-home-2',
      });

    expect(criarSegundo.status).toBe(201);
    segundoModeloGpuId = (criarSegundo.body as { id: number }).id;

    const aprovarSegundo = await request(app.getHttpServer())
      .patch(`/api/admin/hardwares/modelos-3d/${segundoModeloGpuId}/aprovar`)
      .set('Cookie', cookieAdmin);

    expect(aprovarSegundo.status).toBe(200);

    const trocarPeloPatchGeral = await request(app.getHttpServer())
      .patch(`/api/admin/hardwares/modelos-3d/${segundoModeloGpuId}`)
      .set('Cookie', cookieAdmin)
      .send({ mostrarNoHome: true });

    expect(trocarPeloPatchGeral.status).toBe(200);
    expect(trocarPeloPatchGeral.body).toMatchObject({
      id: segundoModeloGpuId,
      mostrarNoHome: true,
    });

    const modelos = await prisma.modelo3DHardware.findMany({
      where: { id: { in: [primeiroModeloGpuId, segundoModeloGpuId] } },
      select: { id: true, mostrarNoHome: true },
    });

    expect(modelos.find((modelo) => modelo.id === primeiroModeloGpuId)).toEqual(
      {
        id: primeiroModeloGpuId,
        mostrarNoHome: false,
      },
    );
    expect(modelos.find((modelo) => modelo.id === segundoModeloGpuId)).toEqual({
      id: segundoModeloGpuId,
      mostrarNoHome: true,
    });

    const home = await request(app.getHttpServer()).get(
      '/api/hardwares/modelos-3d/home',
    );

    expect(home.status).toBe(200);
    expect(home.body).toMatchObject({
      id: segundoModeloGpuId,
      mostrarNoHome: true,
      hardware: {
        id: fixture.hardwares.placaVideoId,
        categoria: 'PLACA_VIDEO',
      },
    });
  });

  it('aceita mostrarNoHome=false no PATCH geral', async () => {
    expect(segundoModeloGpuId).toBeGreaterThan(0);

    const desmarcar = await request(app.getHttpServer())
      .patch(`/api/admin/hardwares/modelos-3d/${segundoModeloGpuId}`)
      .set('Cookie', cookieAdmin)
      .send({ mostrarNoHome: false });

    expect(desmarcar.status).toBe(200);
    expect(desmarcar.body).toMatchObject({
      id: segundoModeloGpuId,
      mostrarNoHome: false,
    });

    const home = await request(app.getHttpServer()).get(
      '/api/hardwares/modelos-3d/home',
    );

    expect(home.status).toBe(200);
    expect(home.text).toBe('');
  });

  it('não permite colocar categoria diferente de placa de vídeo na Home', async () => {
    const res = await request(app.getHttpServer())
      .patch(
        `/api/admin/hardwares/modelos-3d/${fixture.modelos3D.processadorId}`,
      )
      .set('Cookie', cookieAdmin)
      .send({ mostrarNoHome: true });

    expect(res.status).toBe(400);
  });
});
