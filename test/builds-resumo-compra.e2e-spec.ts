import request from 'supertest';
import { CategoriaHardware, TipoMemoria } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';
import {
  componentesBuildFixture,
  criarFixturePcCompleto,
  FixturePcCompleto,
  limparFixturePcCompleto,
} from './fixtures/pc-completo.fixture';

describe('Builds — resumo de compra e validação comercial (e2e)', () => {
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

    const criarBuild = await request(app.getHttpServer())
      .post('/api/admin/builds')
      .set('Cookie', cookieAdmin)
      .send({
        nome: `Build resumo compra E2E ${Date.now()}`,
        publicado: true,
        componentes: componentesBuildFixture(fixture),
      });

    if (criarBuild.status !== 201) {
      throw new Error(
        `Falha ao criar build da fixture: ${criarBuild.status} ${JSON.stringify(criarBuild.body)}`,
      );
    }

    buildId = (criarBuild.body as { id: number }).id;
    produtoBuildId = (criarBuild.body as { produtoId: number }).produtoId;
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

  it('GET /api/builds/:id/resumo-compra → consolida quantidades comerciais e físicas', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/builds/${buildId}/resumo-compra`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('buildId', buildId);
    expect(res.body).toHaveProperty('produtoId', produtoBuildId);
    expect(res.body.componentes).toMatchObject({ totalLinhas: 9 });
    expect(Array.isArray(res.body.itens)).toBe(true);
    expect(res.body.itens).toHaveLength(9);

    const ram = (res.body.itens as Array<Record<string, unknown>>).find(
      (item) => item.categoria === CategoriaHardware.MEMORIA_RAM,
    );

    expect(ram).toMatchObject({
      hardwareId: fixture.hardwares.memoriaRamId,
      quantidadeComercial: 1,
      quantidadeFisica: 2,
    });

    expect(typeof res.body.precoPecasParcial).toBe('number');
    expect(Array.isArray(res.body.componentesSemOferta)).toBe(true);
  });

  it('POST /api/admin/builds → rejeita kit de RAM que excede os slots físicos', async () => {
    const componentes = componentesBuildFixture(fixture).map((item) =>
      item.categoria === CategoriaHardware.MEMORIA_RAM
        ? { ...item, quantidade: 3 }
        : item,
    );

    const res = await request(app.getHttpServer())
      .post('/api/admin/builds')
      .set('Cookie', cookieAdmin)
      .send({
        nome: 'Build inválida RAM E2E',
        publicado: true,
        componentes,
      });

    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/módulo|slot/i);
  });

  it('POST /api/admin/builds → bloqueia publicação com incompatibilidade crítica conhecida', async () => {
    const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cpuIncompativel = await prisma.hardware.create({
      data: {
        nome: `CPU incompatível E2E ${sufixo}`,
        slug: `cpu-incompativel-e2e-${sufixo}`,
        categoria: CategoriaHardware.PROCESSADOR,
        marca: 'CriaByte Testes',
        modelo: `CPU-LGA-${sufixo}`,
        publicado: true,
        ativo: true,
        especificacaoProcessador: {
          create: {
            socket: 'LGA1700',
            nucleos: 6,
            threads: 12,
            tdpWatts: 65,
            possuiVideoIntegrado: true,
            tiposMemoriaSuportados: [TipoMemoria.DDR5],
            capacidadeMemoriaMaximaGb: 128,
          },
        },
      },
    });

    try {
      const componentes = componentesBuildFixture(fixture).map((item) =>
        item.categoria === CategoriaHardware.PROCESSADOR
          ? { ...item, hardwareId: cpuIncompativel.id }
          : item,
      );

      const res = await request(app.getHttpServer())
        .post('/api/admin/builds')
        .set('Cookie', cookieAdmin)
        .send({
          nome: `Build incompatível E2E ${sufixo}`,
          publicado: true,
          componentes,
        });

      expect(res.status).toBe(400);
      expect(res.body.mensagem).toMatch(/incompat|socket/i);
    } finally {
      await prisma.hardware.deleteMany({ where: { id: cpuIncompativel.id } });
    }
  });

  it('POST /api/admin/builds → rejeita mais de uma GPU principal', async () => {
    const componentes = componentesBuildFixture(fixture).map((item) =>
      item.categoria === CategoriaHardware.PLACA_VIDEO
        ? { ...item, quantidade: 2 }
        : item,
    );

    const res = await request(app.getHttpServer())
      .post('/api/admin/builds')
      .set('Cookie', cookieAdmin)
      .send({
        nome: 'Build inválida GPU E2E',
        publicado: true,
        componentes,
      });

    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/no máximo uma unidade.*PLACA_VIDEO/i);
  });
});
