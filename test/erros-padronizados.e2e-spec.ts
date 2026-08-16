/**
 * Testes e2e — Erros padronizados da API
 *
 * Garante que TODAS as respostas de erro seguem o formato:
 * { statusCode, codigo, mensagem, detalhes }
 */
import request from 'supertest';
import { App, criarApp } from './app-setup';

describe('Erros padronizados (e2e)', () => {
  let app: App;

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('404 — rota inexistente tem formato padronizado', async () => {
    const res = await request(app.getHttpServer()).get('/api/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      codigo: expect.any(String),
      mensagem: expect.any(String),
      detalhes: expect.any(Object),
    });
  });

  it('400 — validação retorna formato padronizado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nao-e-email' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      codigo: expect.any(String),
      mensagem: expect.any(String),
      detalhes: expect.any(Object),
    });
  });

  it('401 — credenciais inválidas retornam formato padronizado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      // Email válido mas senha errada (senha satisfaz validação mínima do DTO)
      .send({ email: 'admin@pcbuilder.local', senha: 'SenhaErrada@999' });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      statusCode: 401,
      codigo: expect.any(String),
      mensagem: expect.any(String),
      detalhes: expect.any(Object),
    });
  });

  it('403 — acesso negado retorna formato padronizado', async () => {
    // rota admin sem cookie → deve retornar 403 ou 401
    const res = await request(app.getHttpServer()).get('/api/admin/hardwares');

    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty('statusCode');
    expect(res.body).toHaveProperty('codigo');
    expect(res.body).toHaveProperty('mensagem');
    expect(res.body).toHaveProperty('detalhes');
  });
});
