/**
 * Testes e2e — Catálogo de Hardwares (rotas públicas)
 *
 * Cobre: listagem, busca por ID e rota admin sem depender de registros
 * previamente existentes no banco de testes.
 */
import request from 'supertest';
import { CategoriaHardware } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';

describe('Hardwares públicos (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let hardwareId = 0;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);

    const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const hardware = await prisma.hardware.create({
      data: {
        nome: `Hardware público E2E ${sufixo}`,
        slug: `hardware-publico-e2e-${sufixo}`,
        categoria: CategoriaHardware.MOUSE,
        marca: 'CriaByte Testes',
        modelo: `PUBLICO-${sufixo}`,
        publicado: true,
        ativo: true,
      },
    });
    hardwareId = hardware.id;
  });

  afterAll(async () => {
    if (prisma && hardwareId) {
      await prisma.hardware.deleteMany({ where: { id: hardwareId } });
    }
    if (app) await app.close();
  });

  it('GET /api/hardwares — retorna lista de hardwares publicados', async () => {
    const res = await request(app.getHttpServer()).get('/api/hardwares');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(
      res.body.some((item: { id: number }) => item.id === hardwareId),
    ).toBe(true);
  });

  it('GET /api/hardwares/:id — hardware publicado existente → 200', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/hardwares/${hardwareId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', hardwareId);
  });

  it('GET /api/hardwares/:id-inexistente — ID inexistente → 404 padronizado', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/hardwares/2147483000',
    );
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
