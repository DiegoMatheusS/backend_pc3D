/**
 * Helper reutilizável para testes e2e do CriaByte.
 *
 * Sobe a aplicação NestJS completa e garante que os testes administrativos
 * não dependam de um usuário previamente existente no banco.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PapelUsuario } from '../../src/generated/prisma/enums';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

export type App = INestApplication;

export const ADMIN_E2E_EMAIL = 'admin.e2e@criabyte.test';
export const ADMIN_E2E_SENHA = 'TesteE2E@123456';

export async function criarApp(): Promise<App> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const { FiltroHttpExcecoes } =
    await import('../../src/common/filters/http-excecoes.filter');
  app.useGlobalFilters(new FiltroHttpExcecoes());
  await app.init();
  return app;
}

/**
 * Cria/normaliza um ADMIN exclusivo de E2E.
 * Isso permite executar a suíte em um banco de testes recém-migrado,
 * sem depender do admin do ambiente de desenvolvimento.
 */
export async function garantirAdminTeste(app: App): Promise<void> {
  const prisma = app.get(PrismaService);
  const senhaHash = await argon2.hash(ADMIN_E2E_SENHA, {
    type: argon2.argon2id,
  });

  await prisma.usuario.upsert({
    where: { email: ADMIN_E2E_EMAIL },
    create: {
      nome: 'Administrador E2E',
      email: ADMIN_E2E_EMAIL,
      senhaHash,
      papel: PapelUsuario.ADMIN,
      ativo: true,
    },
    update: {
      nome: 'Administrador E2E',
      senhaHash,
      papel: PapelUsuario.ADMIN,
      ativo: true,
    },
  });
}

/**
 * Garante o ADMIN de teste, faz login e retorna o cookie de sessão.
 */
export async function loginAdmin(app: App): Promise<string> {
  await garantirAdminTeste(app);

  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: ADMIN_E2E_EMAIL, senha: ADMIN_E2E_SENHA });

  if (res.status !== 200) {
    throw new Error(`Login falhou: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const cookie = res.headers['set-cookie'];
  if (!cookie) {
    throw new Error('Cookie de sessão não encontrado na resposta de login');
  }
  return Array.isArray(cookie) ? cookie[0] : cookie;
}
