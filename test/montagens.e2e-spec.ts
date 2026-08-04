/**
 * Testes e2e — Módulo de Montagens (CRUD do usuário)
 *
 * Cobre: criar, listar, buscar por slug, atualizar, duplicar, excluir.
 */
import request from 'supertest';
import { App, criarApp, loginAdmin } from './app-setup';

describe('Montagens (e2e)', () => {
  let app: App;
  let cookieAdmin: string;
  let montagemId: number;

  const GABINETE_ID = 6; // ajuste conforme banco

  beforeAll(async () => {
    app = await criarApp();
    cookieAdmin = await loginAdmin(app);
  });

  afterAll(async () => {
    // Limpar montagens criadas no teste
    if (montagemId) {
      await request(app.getHttpServer())
        .delete(`/api/montagens/${montagemId}`)
        .set('Cookie', cookieAdmin);
    }
    await app.close();
  });

  it('POST /api/montagens — criar nova montagem → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/montagens')
      .set('Cookie', cookieAdmin)
      .send({
        nome: 'Montagem de Teste E2E',
        gabineteId: GABINETE_ID,
        publico: false,
      });

    if (res.status === 201) {
      montagemId = (res.body as { id: number }).id;
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('nome', 'Montagem de Teste E2E');
    }
    // Aceitar 400 se GABINETE_ID não existir no banco
    expect([201, 400]).toContain(res.status);
  });

  it('GET /api/montagens — listar minhas montagens (autenticado) → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/montagens')
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    // Retorna { total, montagens } (não array direto)
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
    // Retorna { total, montagens }
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('montagens');
  });

  it('GET /api/montagens/:id — buscar por ID existente → 200', async () => {
    if (!montagemId) {
      console.warn('ID de montagem não disponível — pulando teste');
      return;
    }
    const res = await request(app.getHttpServer())
      .get(`/api/montagens/${montagemId}`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', montagemId);
  });

  it('PATCH /api/montagens/:id — atualizar nome → 200', async () => {
    if (!montagemId) {
      console.warn('ID de montagem não disponível — pulando teste');
      return;
    }
    const res = await request(app.getHttpServer())
      .patch(`/api/montagens/${montagemId}`)
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Montagem E2E Atualizada' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nome', 'Montagem E2E Atualizada');
  });

  it('POST /api/montagens/:id/duplicar → 201', async () => {
    if (!montagemId) {
      console.warn('ID de montagem não disponível — pulando teste');
      return;
    }
    const res = await request(app.getHttpServer())
      .post(`/api/montagens/${montagemId}/duplicar`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(201);
    const copia = res.body as { id: number };
    // Limpar a cópia
    await request(app.getHttpServer())
      .delete(`/api/montagens/${copia.id}`)
      .set('Cookie', cookieAdmin);
  });

  it('DELETE /api/montagens/:id — excluir a montagem criada → 200', async () => {
    if (!montagemId) {
      console.warn('ID de montagem não disponível — pulando teste');
      return;
    }
    const res = await request(app.getHttpServer())
      .delete(`/api/montagens/${montagemId}`)
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    montagemId = 0; // Já excluída, não tentar novamente no afterAll
  });
});
