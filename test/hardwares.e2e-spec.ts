/**
 * Testes e2e — Catálogo de Hardwares (rotas públicas)
 *
 * Cobre: listagem, busca por ID, rota admin com guards de papel.
 */
import request from 'supertest';
import { App, criarApp, loginAdmin } from './app-setup';

describe('Hardwares públicos (e2e)', () => {
  let app: App;
  let cookieAdmin: string;

  beforeAll(async () => {
    app = await criarApp();
    cookieAdmin = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/hardwares — retorna lista de hardwares publicados', async () => {
    const res = await request(app.getHttpServer()).get('/api/hardwares');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/hardwares/:id — hardware publicado existente → 200', async () => {
    // Buscar o primeiro da lista para pegar um ID real
    const lista = await request(app.getHttpServer()).get('/api/hardwares');
    if (lista.body.length === 0) {
      console.warn('Nenhum hardware publicado encontrado — pulando teste');
      return;
    }
    const id = (lista.body[0] as { id: number }).id;
    const res = await request(app.getHttpServer()).get(`/api/hardwares/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', id);
  });

  it('GET /api/hardwares/9999 — ID inexistente → 404 padronizado', async () => {
    const res = await request(app.getHttpServer()).get('/api/hardwares/9999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('codigo');
  });

  it('GET /api/admin/hardwares — sem autenticação → 401 ou 403', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/hardwares');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/admin/hardwares — admin autenticado → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/hardwares')
      .set('Cookie', cookieAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
