import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';

describe('Usuários — criação segura de conta (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;

  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailUsuario = `usuario.criado.${sufixo}@example.com`;
  const emailTentativaPapel = `usuario.papel.${sufixo}@example.com`;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.usuario.deleteMany({
        where: { email: { in: [emailUsuario, emailTentativaPapel] } },
      });
    }
    if (app) await app.close();
  });

  it('POST /api/usuarios — nova conta administrativa também nasce como USUARIO', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Cookie', cookieAdmin)
      .send({
        nome: 'Usuário Criado E2E',
        email: emailUsuario,
        senha: 'UsuarioE2E@123456',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: emailUsuario,
      papel: 'USUARIO',
      ativo: true,
    });
  });

  it('POST /api/usuarios — não permite escolher ADMIN/EDITOR/REVISOR na criação', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Cookie', cookieAdmin)
      .send({
        nome: 'Tentativa Papel E2E',
        email: emailTentativaPapel,
        senha: 'UsuarioE2E@123456',
        papel: 'ADMIN',
      });

    expect(res.status).toBe(400);

    const usuario = await prisma.usuario.findUnique({
      where: { email: emailTentativaPapel },
    });
    expect(usuario).toBeNull();
  });
});
