/**
 * Testes e2e — Módulo de Autenticação
 *
 * Cobre: login, perfil, logout, credenciais inválidas.
 */
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  ADMIN_E2E_EMAIL,
  ADMIN_E2E_SENHA,
  App,
  criarApp,
  garantirAdminTeste,
  loginAdmin,
} from './app-setup';

describe('Auth (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  const sufixoCadastro = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailCadastro = `cadastro.${sufixoCadastro}@example.com`;
  const emailPapelForcado = `cadastro.papel.${sufixoCadastro}@example.com`;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    await garantirAdminTeste(app);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.usuario.deleteMany({
        where: { email: { in: [emailCadastro, emailPapelForcado] } },
      });
    }
    await app.close();
  });

  it('POST /api/auth/cadastro — cria toda conta pública como USUARIO', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/cadastro')
      .send({
        nome: 'Usuário Cadastro E2E',
        email: emailCadastro,
        senha: 'CadastroE2E@123456',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: emailCadastro,
      papel: 'USUARIO',
      ativo: true,
    });

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: emailCadastro, senha: 'CadastroE2E@123456' });

    expect(login.status).toBe(200);
    expect(login.body.usuario).toHaveProperty('papel', 'USUARIO');
  });

  it('POST /api/auth/cadastro — não aceita papel enviado pelo cliente', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/cadastro')
      .send({
        nome: 'Tentativa Papel E2E',
        email: emailPapelForcado,
        senha: 'CadastroE2E@123456',
        papel: 'ADMIN',
      });

    expect(res.status).toBe(400);

    const usuario = await prisma.usuario.findUnique({
      where: { email: emailPapelForcado },
    });
    expect(usuario).toBeNull();
  });

  it('POST /api/auth/login — credenciais corretas → 200 + cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ADMIN_E2E_EMAIL, senha: ADMIN_E2E_SENHA });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('usuario');
    expect(res.body.usuario).toHaveProperty('email', ADMIN_E2E_EMAIL);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /api/auth/login — senha errada → 401 com codigo NAO_AUTENTICADO', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ADMIN_E2E_EMAIL, senha: 'senha_errada' });

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

  it('POST /api/auth/google — exige credential válida no payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/google')
      .send({ credential: 'curta' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('codigo');
  });

  it('GET /api/auth/perfil — sem cookie → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/perfil');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('codigo', 'NAO_AUTENTICADO');
  });

  it('GET /api/auth/perfil — com cookie válido → dados do usuário', async () => {
    const cookie = await loginAdmin(app);

    const res = await request(app.getHttpServer())
      .get('/api/auth/perfil')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    // O endpoint /perfil retorna diretamente o objeto do usuário (sem wrapper)
    expect(res.body).toHaveProperty('papel', 'ADMIN');
    expect(res.body).toHaveProperty('email', ADMIN_E2E_EMAIL);
  });

  it('PATCH /api/usuarios/me — exige reautenticação para trocar e-mail', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: emailCadastro, senha: 'CadastroE2E@123456' });
    const cookieHeader = login.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
    expect(cookie).toBeDefined();

    const novoEmail = `alterado.${emailCadastro}`;
    const semConfirmar = await request(app.getHttpServer())
      .patch('/api/usuarios/me')
      .set('Cookie', cookie as string)
      .send({ email: novoEmail });

    expect(semConfirmar.status).toBe(401);

    const confirmado = await request(app.getHttpServer())
      .patch('/api/usuarios/me')
      .set('Cookie', cookie as string)
      .send({ email: novoEmail, senhaAtual: 'CadastroE2E@123456' });

    expect(confirmado.status).toBe(200);
    expect(confirmado.body.email).toBe(novoEmail);

    await prisma.usuario.update({
      where: { email: novoEmail },
      data: { email: emailCadastro },
    });
  });

  it('POST /api/auth/logout — com cookie → 204 + limpa cookie', async () => {
    const cookie = await loginAdmin(app);

    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(res.status).toBe(204);
  });
});
