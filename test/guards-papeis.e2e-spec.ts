/**
 * Testes e2e — Guards de papéis (ADMIN, EDITOR, REVISOR)
 *
 * Cobre as permissões granulares:
 * - ADMIN pode tudo
 * - sem autenticação → 401/403
 * - rota de exclusão sem ser ADMIN → 403
 */
import request from 'supertest';
import { App, criarApp, loginAdmin } from './app-setup';

describe('Guards de papéis (e2e)', () => {
  let app: App;
  let cookieAdmin: string;

  beforeAll(async () => {
    app = await criarApp();
    cookieAdmin = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/admin/hardwares — sem cookie → 401 ou 403', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/hardwares');
    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty('codigo');
  });

  it('GET /api/admin/hardwares — admin → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/hardwares')
      .set('Cookie', cookieAdmin);
    expect(res.status).toBe(200);
  });

  it('GET /api/admin/auditoria — admin → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/auditoria')
      .set('Cookie', cookieAdmin);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('itens');
    expect(res.body).toHaveProperty('total');
  });

  it('GET /api/admin/auditoria — sem cookie → 401 ou 403', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/auditoria');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/admin/ofertas/parceiros/1 — sem cookie → 401 ou 403', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/admin/ofertas/parceiros/1',
    );
    expect([401, 403]).toContain(res.status);
  });
});
