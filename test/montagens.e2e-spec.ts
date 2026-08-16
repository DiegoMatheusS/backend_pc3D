/**
 * Testes e2e — Módulo de Montagens (CRUD do usuário)
 *
 * Cobre: criar, listar, buscar, atualizar, duplicar e excluir sem depender
 * de IDs fixos pré-existentes no banco.
 */
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';
import {
  criarFixturePcCompleto,
  FixturePcCompleto,
  limparFixturePcCompleto,
} from './fixtures/pc-completo.fixture';

describe('Montagens (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let montagemId = 0;
  let fixture: FixturePcCompleto;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);
    fixture = await criarFixturePcCompleto(prisma);
  });

  afterAll(async () => {
    if (montagemId) {
      await request(app.getHttpServer())
        .delete(`/api/montagens/${montagemId}`)
        .set('Cookie', cookieAdmin);
    }
    if (prisma && fixture) {
      await limparFixturePcCompleto(prisma, fixture);
    }
    if (app) await app.close();
  });

  it('POST /api/montagens — criar nova montagem → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/montagens')
      .set('Cookie', cookieAdmin)
      .send({
        nome: 'Montagem de Teste E2E',
        gabineteId: fixture.hardwares.gabineteId,
        publico: false,
        itens: [
          {
            instanciaId: 'placa-mae-1',
            pontoEncaixeId: fixture.pontos.placaMae,
            hardwareFilhoId: fixture.hardwares.placaMaeId,
          },
          {
            instanciaId: 'processador-1',
            instanciaPaiId: 'placa-mae-1',
            pontoEncaixeId: fixture.pontos.cpu,
            hardwareFilhoId: fixture.hardwares.processadorId,
          },
        ],
      });

    expect(res.status).toBe(201);
    montagemId = (res.body as { id: number }).id;
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('nome', 'Montagem de Teste E2E');
    expect(res.body._count).toHaveProperty('itens', 2);
  });

  it('GET /api/montagens — listar minhas montagens (autenticado) → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/montagens')
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('montagens');
    expect(Array.isArray(res.body.montagens)).toBe(true);
  });

  it('GET /api/montagens — sem autenticação → 401 ou 403', async () => {
    const res = await request(app.getHttpServer()).get('/api/montagens');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/montagens/publicas — público sem auth → 200', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/montagens/publicas',
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('montagens');
  });

  it('GET /api/montagens/:id — buscar por ID existente → 200', async () => {
    expect(montagemId).toBeGreaterThan(0);
    const res = await request(app.getHttpServer())
      .get(`/api/montagens/${montagemId}`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', montagemId);
  });

  it('PATCH /api/montagens/:id — atualizar nome → 200', async () => {
    expect(montagemId).toBeGreaterThan(0);
    const res = await request(app.getHttpServer())
      .patch(`/api/montagens/${montagemId}`)
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Montagem E2E Atualizada' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nome', 'Montagem E2E Atualizada');
  });

  it('PATCH /api/montagens/:id — rejeita fonte que não existe na árvore 3D', async () => {
    expect(montagemId).toBeGreaterThan(0);
    const res = await request(app.getHttpServer())
      .patch(`/api/montagens/${montagemId}`)
      .set('Cookie', cookieAdmin)
      .send({ fonteId: fixture.hardwares.fonteId });

    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/fonte.*árvore 3D/i);
  });

  it('montagem publicada pode ser resolvida anonimamente', async () => {
    expect(montagemId).toBeGreaterThan(0);

    const publicar = await request(app.getHttpServer())
      .patch(`/api/montagens/${montagemId}`)
      .set('Cookie', cookieAdmin)
      .send({ publico: true, status: 'PUBLICADA' });

    expect(publicar.status).toBe(200);

    const resolver = await request(app.getHttpServer()).get(
      `/api/montagens/${montagemId}/resolver`,
    );

    expect(resolver.status).toBe(200);
    expect(resolver.body).toHaveProperty('hardwarePai');
    expect(resolver.body).toHaveProperty('preco');
  });

  it('POST /api/montagens/:id/duplicar → 201', async () => {
    expect(montagemId).toBeGreaterThan(0);
    const res = await request(app.getHttpServer())
      .post(`/api/montagens/${montagemId}/duplicar`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(201);
    const copia = res.body as { id: number };
    await request(app.getHttpServer())
      .delete(`/api/montagens/${copia.id}`)
      .set('Cookie', cookieAdmin);
  });

  it('DELETE /api/montagens/:id — arquiva sem apagar fisicamente → 200', async () => {
    expect(montagemId).toBeGreaterThan(0);
    const res = await request(app.getHttpServer())
      .delete(`/api/montagens/${montagemId}`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ARQUIVADA');

    const persistida = await request(app.getHttpServer())
      .get(`/api/montagens/${montagemId}`)
      .set('Cookie', cookieAdmin);

    expect(persistida.status).toBe(200);
    expect(persistida.body).toHaveProperty('status', 'ARQUIVADA');
    expect(persistida.body).toHaveProperty('publico', false);

    const minhas = await request(app.getHttpServer())
      .get('/api/montagens')
      .set('Cookie', cookieAdmin);

    expect(minhas.status).toBe(200);
    expect(
      (minhas.body.montagens as Array<{ id: number }>).some(
        (item) => item.id === montagemId,
      ),
    ).toBe(false);

    const editarArquivada = await request(app.getHttpServer())
      .patch(`/api/montagens/${montagemId}`)
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Não deve editar' });

    expect(editarArquivada.status).toBe(400);
    montagemId = 0;
  });
});
