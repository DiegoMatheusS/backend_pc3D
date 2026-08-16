import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';
import {
  criarFixturePcCompleto,
  FixturePcCompleto,
  limparFixturePcCompleto,
} from './fixtures/pc-completo.fixture';

describe('Modelos 3D — origem e metadados (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let fixture: FixturePcCompleto;
  let modeloExternoId = 0;

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

  it('cadastra modelo externo guardando somente URL e metadados', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/api/admin/hardwares/${fixture.hardwares.processadorId}/modelos-3d`,
      )
      .set('Cookie', cookieAdmin)
      .send({
        nome: 'Modelo externo E2E',
        arquivoUrl: 'https://cdn.example.test/modelos/cpu-e2e.glb',
        formato: 'GLB',
        origem: 'EXTERNO',
        fonteUrl: 'https://example.test/modelos/cpu-e2e',
        autor: 'Autor E2E',
        licenca: 'Licença de teste',
      });

    expect(res.status).toBe(201);
    modeloExternoId = (res.body as { id: number }).id;
    expect(res.body).toMatchObject({
      origem: 'EXTERNO',
      arquivoUrl: 'https://cdn.example.test/modelos/cpu-e2e.glb',
      fonteUrl: 'https://example.test/modelos/cpu-e2e',
      autor: 'Autor E2E',
      licenca: 'Licença de teste',
      storageKey: null,
      aprovado: false,
    });
  });

  it('aprova e expõe metadados do modelo externo na API pública', async () => {
    expect(modeloExternoId).toBeGreaterThan(0);

    const aprovar = await request(app.getHttpServer())
      .patch(`/api/admin/hardwares/modelos-3d/${modeloExternoId}/aprovar`)
      .set('Cookie', cookieAdmin);

    expect(aprovar.status).toBe(200);

    const publico = await request(app.getHttpServer()).get(
      `/api/hardwares/${fixture.hardwares.processadorId}/modelos-3d`,
    );

    expect(publico.status).toBe(200);
    const modelo = (
      publico.body.modelos as Array<Record<string, unknown>>
    ).find((item) => item.id === modeloExternoId);

    expect(modelo).toMatchObject({
      id: modeloExternoId,
      origem: 'EXTERNO',
      fonteUrl: 'https://example.test/modelos/cpu-e2e',
      autor: 'Autor E2E',
      licenca: 'Licença de teste',
    });
  });

  it('permite modelo próprio apontando para storage/CDN sem salvar o arquivo no banco', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/hardwares/${fixture.hardwares.memoriaRamId}/modelos-3d`)
      .set('Cookie', cookieAdmin)
      .send({
        nome: 'Modelo próprio E2E',
        arquivoUrl: 'https://cdn.criabyte.test/modelos/ram-e2e.glb',
        formato: 'GLB',
        origem: 'PROPRIO',
        storageKey: 'modelos/ram-e2e.glb',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      origem: 'PROPRIO',
      storageKey: 'modelos/ram-e2e.glb',
      arquivoUrl: 'https://cdn.criabyte.test/modelos/ram-e2e.glb',
    });
  });
});
