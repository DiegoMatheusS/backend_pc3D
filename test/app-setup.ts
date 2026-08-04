/**
 * Helper reutilizável para testes e2e do PC Builder.
 *
 * Sobe a aplicação NestJS completa (AppModule) incluindo todos os
 * pipes, filtros e middlewares já configurados em main.ts.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import request from 'supertest';
import cookieParser from 'cookie-parser';

export type App = INestApplication;

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
    await import('../src/common/filters/http-excecoes.filter');
  app.useGlobalFilters(new FiltroHttpExcecoes());
  await app.init();
  return app;
}

/**
 * Faz login e retorna o cookie de sessão.
 */
export async function loginAdmin(app: App): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: 'admin@pcbuilder.local', senha: 'Teste@123456' });

  if (res.status !== 200) {
    throw new Error(`Login falhou: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const cookie = res.headers['set-cookie'];
  if (!cookie)
    throw new Error('Cookie de sessão não encontrado na resposta de login');
  return Array.isArray(cookie) ? cookie[0] : cookie;
}
