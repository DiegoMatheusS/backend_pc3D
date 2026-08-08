import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp } from './app-setup';
import {
  criarFixturePcCompleto,
  FixturePcCompleto,
  itensMontagemCompletaFixture,
  limparFixturePcCompleto,
} from './fixtures/pc-completo.fixture';

describe('Montagem completa — integridade entre árvore e diagnóstico (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let fixture: FixturePcCompleto;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    fixture = await criarFixturePcCompleto(prisma);
  });

  afterAll(async () => {
    if (prisma && fixture) {
      await limparFixturePcCompleto(prisma, fixture);
    }
    if (app) await app.close();
  });

  it('infere fonte e cooler diretamente da árvore 3D', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/api/hardwares/${fixture.hardwares.gabineteId}/montagem-completa/resolver`,
      )
      .send({ itens: itensMontagemCompletaFixture(fixture) });

    expect(res.status).toBe(200);
    expect(res.body.montagem3D).toMatchObject({
      total: 11,
      montagemRenderizavel: true,
    });
    expect(res.body.resumoFisico).toMatchObject({
      placasMae: 1,
      processadores: 1,
      placasVideo: 1,
      fontes: 1,
      coolers: 1,
      modulosRam: 2,
      capacidadeMemoriaTotalGb: 16,
      armazenamentos: 1,
      ventoinhas: 3,
    });
  });

  it('rejeita fonteId divergente da fonte presente na árvore 3D', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/api/hardwares/${fixture.hardwares.gabineteId}/montagem-completa/resolver`,
      )
      .send({
        itens: itensMontagemCompletaFixture(fixture),
        fonteId: 2147483000,
      });

    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/fonteId|fonte.*árvore/i);
  });

  it('rejeita coolerId divergente do cooler presente na árvore 3D', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/api/hardwares/${fixture.hardwares.gabineteId}/montagem-completa/resolver`,
      )
      .send({
        itens: itensMontagemCompletaFixture(fixture),
        coolerId: 2147483000,
      });

    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/coolerId|cooler.*árvore/i);
  });
});
