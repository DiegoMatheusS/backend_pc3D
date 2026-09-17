import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp } from './app-setup';

describe('Likes de produtos por usuário (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let produtoId: number;
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `like.a.${sufixo}@example.com`;
  const emailB = `like.b.${sufixo}@example.com`;
  const senha = 'LikeE2E@123456';

  async function cadastrarELogar(nome: string, email: string): Promise<string> {
    const cadastro = await request(app.getHttpServer())
      .post('/api/auth/cadastro')
      .send({ nome, email, senha });
    expect(cadastro.status).toBe(201);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, senha });
    expect(login.status).toBe(200);

    const cookieHeader = login.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
    expect(cookie).toBeDefined();
    return cookie as string;
  }

  async function resumo(cookie?: string) {
    const requisicao = request(app.getHttpServer()).get(
      `/api/produto-likes/resumo?ids=${produtoId}`,
    );
    if (cookie) requisicao.set('Cookie', cookie);
    const resposta = await requisicao;
    expect(resposta.status).toBe(200);
    return resposta.body.itens[0] as {
      produtoId: number;
      likesCount: number;
      likedByUser: boolean;
    };
  }

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);

    const catalogo = await request(app.getHttpServer()).get(
      '/api/produtos?pagina=1&limite=1',
    );
    expect(catalogo.status).toBe(200);
    expect(catalogo.body.dados?.length).toBeGreaterThan(0);
    produtoId = Number(catalogo.body.dados[0].id);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.usuario.deleteMany({
        where: { email: { in: [emailA, emailB] } },
      });
    }
    await app.close();
  });

  it('permite um like do mesmo produto para cada conta e mantém a operação idempotente', async () => {
    const cookieA = await cadastrarELogar('Like Usuário A', emailA);
    const cookieB = await cadastrarELogar('Like Usuário B', emailB);
    const inicial = await resumo();

    const likeA = await request(app.getHttpServer())
      .post(`/api/produto-likes/${produtoId}`)
      .set('Cookie', cookieA);
    expect(likeA.status).toBe(201);
    expect(likeA.body).toMatchObject({
      produtoId,
      likedByUser: true,
      likesCount: inicial.likesCount + 1,
    });

    const vistoPorB = await resumo(cookieB);
    expect(vistoPorB.likedByUser).toBe(false);
    expect(vistoPorB.likesCount).toBe(inicial.likesCount + 1);

    const likeB = await request(app.getHttpServer())
      .post(`/api/produto-likes/${produtoId}`)
      .set('Cookie', cookieB);
    expect(likeB.status).toBe(201);
    expect(likeB.body.likesCount).toBe(inicial.likesCount + 2);

    const likeARepetido = await request(app.getHttpServer())
      .post(`/api/produto-likes/${produtoId}`)
      .set('Cookie', cookieA);
    expect(likeARepetido.status).toBe(201);
    expect(likeARepetido.body.likesCount).toBe(inicial.likesCount + 2);

    const removerA = await request(app.getHttpServer())
      .delete(`/api/produto-likes/${produtoId}`)
      .set('Cookie', cookieA);
    expect(removerA.status).toBe(200);
    expect(removerA.body).toMatchObject({
      produtoId,
      likedByUser: false,
      likesCount: inicial.likesCount + 1,
    });

    const finalB = await resumo(cookieB);
    expect(finalB.likedByUser).toBe(true);
    expect(finalB.likesCount).toBe(inicial.likesCount + 1);
  });

  it('exige login para curtir', async () => {
    const resposta = await request(app.getHttpServer()).post(
      `/api/produto-likes/${produtoId}`,
    );
    expect(resposta.status).toBe(401);
  });
});
