/**
 * Testes e2e — Montagem 3D: arquitetura de instâncias físicas
 *
 * Cobre os casos críticos da arquitetura por instanciaId sem depender
 * de IDs fixos existentes no banco. Cada suíte cria e remove sua própria
 * fixture técnica no banco exclusivo de testes.
 */
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp } from './app-setup';
import {
  criarFixturePcCompleto,
  FixturePcCompleto,
  limparFixturePcCompleto,
} from './fixtures/pc-completo.fixture';

describe('Montagem 3D — arquitetura de instâncias (e2e)', () => {
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

  const post = (body: object) =>
    request(app.getHttpServer())
      .post(
        `/api/hardwares/${fixture.hardwares.gabineteId}/montagem-3d/resolver`,
      )
      .send(body);

  it('montagem simples com IDs explícitos → 200', async () => {
    const res = await post({
      itens: [
        {
          instanciaId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.placaMae,
          hardwareFilhoId: fixture.hardwares.placaMaeId,
        },
        {
          instanciaId: 'cpu-1',
          instanciaPaiId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.cpu,
          hardwareFilhoId: fixture.hardwares.processadorId,
        },
        {
          instanciaId: 'ram-1',
          instanciaPaiId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.ram1,
          hardwareFilhoId: fixture.hardwares.memoriaRamId,
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('itens');
    expect(res.body).toHaveProperty('hardwarePai');
    expect(res.body.hardwarePai).toHaveProperty(
      'id',
      fixture.hardwares.gabineteId,
    );
    expect(res.body.itens).toHaveLength(3);
  });

  it('duas RAMs com mesmo hardwareId → instâncias diferentes coexistem', async () => {
    const res = await post({
      itens: [
        {
          instanciaId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.placaMae,
          hardwareFilhoId: fixture.hardwares.placaMaeId,
        },
        {
          instanciaId: 'cpu-1',
          instanciaPaiId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.cpu,
          hardwareFilhoId: fixture.hardwares.processadorId,
        },
        {
          instanciaId: 'ram-1',
          instanciaPaiId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.ram1,
          hardwareFilhoId: fixture.hardwares.memoriaRamId,
        },
        {
          instanciaId: 'ram-2',
          instanciaPaiId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.ram2,
          hardwareFilhoId: fixture.hardwares.memoriaRamId,
        },
      ],
    });

    expect(res.status).toBe(200);
    const instancias = (res.body.itens as Array<{ instanciaId: string }>).map(
      (item) => item.instanciaId,
    );
    expect(instancias).toContain('ram-1');
    expect(instancias).toContain('ram-2');
  });

  it('instanciaId duplicado → 400 com mensagem de unicidade', async () => {
    const res = await post({
      itens: [
        {
          instanciaId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.placaMae,
          hardwareFilhoId: fixture.hardwares.placaMaeId,
        },
        {
          instanciaId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.gpu,
          hardwareFilhoId: fixture.hardwares.placaVideoId,
        },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('codigo');
    expect(res.body.mensagem).toMatch(/único|instanciaId/i);
  });

  it('mesmo slot na mesma instância pai → 400', async () => {
    const res = await post({
      itens: [
        {
          instanciaId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.placaMae,
          hardwareFilhoId: fixture.hardwares.placaMaeId,
        },
        {
          instanciaId: 'ram-1',
          instanciaPaiId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.ram1,
          hardwareFilhoId: fixture.hardwares.memoriaRamId,
        },
        {
          instanciaId: 'ram-2',
          instanciaPaiId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.ram1,
          hardwareFilhoId: fixture.hardwares.memoriaRamId,
        },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/ponto de encaixe/i);
  });

  it('instanciaId reservado da raiz → 400', async () => {
    const res = await post({
      itens: [
        {
          instanciaId: `hardware-raiz-${fixture.hardwares.gabineteId}`,
          pontoEncaixeId: fixture.pontos.placaMae,
          hardwareFilhoId: fixture.hardwares.placaMaeId,
        },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/reservado/i);
  });

  it('instância encaixada nela mesma → 400', async () => {
    const res = await post({
      itens: [
        {
          instanciaId: 'placa-mae-1',
          instanciaPaiId: 'placa-mae-1',
          pontoEncaixeId: fixture.pontos.placaMae,
          hardwareFilhoId: fixture.hardwares.placaMaeId,
        },
      ],
    });

    expect(res.status).toBe(400);
  });

  it('instanciaPaiId inexistente → 400', async () => {
    const res = await post({
      itens: [
        {
          instanciaId: 'cpu-1',
          instanciaPaiId: 'placa-mae-inexistente',
          pontoEncaixeId: fixture.pontos.cpu,
          hardwareFilhoId: fixture.hardwares.processadorId,
        },
      ],
    });

    expect(res.status).toBe(400);
  });

  it('lista vazia → 400', async () => {
    const res = await post({ itens: [] });
    expect(res.status).toBe(400);
  });

  it('gabinete inexistente → 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/hardwares/2147483000/montagem-3d/resolver')
      .send({
        itens: [
          {
            pontoEncaixeId: fixture.pontos.placaMae,
            hardwareFilhoId: fixture.hardwares.placaMaeId,
          },
        ],
      });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('codigo');
  });
});
