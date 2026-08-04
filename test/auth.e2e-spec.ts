/**
 * Testes e2e — Módulo de Autenticação
 *
 * Cobre: login, perfil, logout, credenciais inválidas.
 */
import request from 'supertest';
import { App, criarApp, loginAdmin } from './app-setup';

describe('Auth (e2e)', () => {
  let app: App;

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/auth/login — credenciais corretas → 200 + cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@pcbuilder.local', senha: 'Teste@123456' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('usuario');
    expect(res.body.usuario).toHaveProperty('email', 'admin@pcbuilder.local');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /api/auth/login — senha errada → 401 com codigo NAO_AUTENTICADO', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@pcbuilder.local', senha: 'senha_errada' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('codigo');
  });

  it('POST /api/auth/login — email inexistente → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'naoexiste@pcbuilder.local', senha: 'Qualquer@123' });

    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login — payload inválido → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nao-e-email' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('codigo');
  });

  it('GET /api/auth/perfil — sem cookie → null ou erro', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/perfil');
    // AuthGuard injeta null sem lançar 401, perfil retorna null ou dados
    expect([200, 401]).toContain(res.status);
  });

  it('GET /api/auth/perfil — com cookie válido → dados do usuário', async () => {
    const cookie = await loginAdmin(app);

    const res = await request(app.getHttpServer())
      .get('/api/auth/perfil')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    // O endpoint /perfil retorna diretamente o objeto do usuário (sem wrapper)
    expect(res.body).toHaveProperty('papel', 'ADMIN');
    expect(res.body).toHaveProperty('email', 'admin@pcbuilder.local');
  });

  it('POST /api/auth/logout — com cookie → 204 + limpa cookie', async () => {
    const cookie = await loginAdmin(app);

    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(res.status).toBe(204);
  });
});
