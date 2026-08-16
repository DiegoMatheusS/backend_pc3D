import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';

describe('Hardware x Produto — separação de catálogo (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let hardwareId: number | null = null;
  let produtoId: number | null = null;
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const mpn = `CB-PSU-${sufixo}`;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);
  });

  afterAll(async () => {
    if (prisma) {
      if (produtoId !== null) {
        await prisma.produto.deleteMany({ where: { id: produtoId } });
      }
      if (hardwareId !== null) {
        await prisma.hardware.deleteMany({ where: { id: hardwareId } });
      }
    }
    if (app) await app.close();
  });

  it('cadastrar Hardware não cria Produto automaticamente', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/hardwares')
      .set('Cookie', cookieAdmin)
      .send({
        nome: `Fonte técnica E2E ${sufixo}`,
        categoria: 'FONTE',
        marca: 'CriaByte Testes',
        modelo: `PSU-${sufixo}`,
        mpn,
        publicado: false,
        ativo: true,
        especificacaoFonte: {
          formato: 'ATX',
          potenciaWatts: 650,
          conectoresAtx24Pinos: 1,
          conectoresEpsCpu: 1,
        },
      });

    expect(res.status).toBe(201);
    hardwareId = res.body.id;
    expect(res.body.produtoId).toBeNull();
    expect(res.body.mpn).toBe(mpn);

    const produto = await prisma.produto.findFirst({ where: { mpn } });
    expect(produto).toBeNull();
  });

  it('Produto comercial só nasce após confirmação explícita a partir do Hardware', async () => {
    expect(hardwareId).not.toBeNull();

    const res = await request(app.getHttpServer())
      .post(`/api/admin/produtos/de-hardware/${hardwareId}`)
      .set('Cookie', cookieAdmin)
      .send({ publicado: false, ativo: true });

    expect(res.status).toBe(201);
    produtoId = res.body.id;
    expect(res.body.tipo).toBe('HARDWARE');
    expect(res.body.hardware.id).toBe(hardwareId);

    const hardware = await prisma.hardware.findUnique({
      where: { id: hardwareId },
      select: { produtoId: true },
    });
    expect(hardware?.produtoId).toBe(produtoId);
  });
});
