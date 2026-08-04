import request from 'supertest';
import { App, criarApp } from './app-setup';

describe('Loja expandida (e2e)', () => {
  let app: App;

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/categorias-produto → 200', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/categorias-produto',
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('categorias');
  });

  it('GET /api/produtos → 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/produtos');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dados');
    expect(res.body).toHaveProperty('total');
  });

  it('GET /api/notebooks → 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/notebooks');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dados');
    expect(res.body).toHaveProperty('total');
  });

  it('GET /api/builds → 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/builds');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dados');
    expect(res.body).toHaveProperty('total');
  });

  it('GET /api/ofertas/parceiros → 200', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/ofertas/parceiros',
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('parceiros');
  });
});
