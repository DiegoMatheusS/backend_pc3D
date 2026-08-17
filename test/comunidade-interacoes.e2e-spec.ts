import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';

jest.setTimeout(30000);

describe('Comunidade — avaliações e comentários (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let cookieAutor: string;
  let cookieOutro: string;
  let autorId: number;
  let outroId: number;
  let buildId: number;
  let comentarioId: number;
  let respostaId: number;

  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const senha = 'Comunidade@123456';
  const emailAutor = `interacao.autor.${sufixo}@example.com`;
  const emailOutro = `interacao.outro.${sufixo}@example.com`;

  const componentesValidos = [
    {
      nome: 'Processador externo E2E',
      categoria: 'PROCESSADOR',
      quantidade: 1,
    },
    { nome: 'Placa-mãe externa E2E', categoria: 'PLACA_MAE', quantidade: 1 },
    {
      nome: 'Memória RAM externa E2E',
      categoria: 'MEMORIA_RAM',
      quantidade: 1,
    },
    {
      nome: 'Placa de vídeo externa E2E',
      categoria: 'PLACA_VIDEO',
      quantidade: 1,
    },
    { nome: 'SSD externo E2E', categoria: 'ARMAZENAMENTO', quantidade: 1 },
    { nome: 'Fonte externa E2E', categoria: 'FONTE', quantidade: 1 },
    { nome: 'Gabinete externo E2E', categoria: 'GABINETE', quantidade: 1 },
    { nome: 'Cooler externo E2E', categoria: 'COOLER', quantidade: 1 },
    {
      nome: 'Ventoinha externa E2E',
      categoria: 'VENTOINHA',
      quantidade: 3,
      posicao: 'FRENTE',
    },
  ];

  async function criarUsuario(email: string, nome: string) {
    const res = await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Cookie', cookieAdmin)
      .send({ nome, email, senha });

    expect(res.status).toBe(201);
    return (res.body as { id: number }).id;
  }

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, senha });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'];
    if (!cookie) throw new Error('Cookie de sessão não retornado.');
    return Array.isArray(cookie) ? cookie[0] : cookie;
  }

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);

    autorId = await criarUsuario(emailAutor, `Autor Interações ${sufixo}`);
    outroId = await criarUsuario(emailOutro, `Outro Interações ${sufixo}`);
    cookieAutor = await login(emailAutor);
    cookieOutro = await login(emailOutro);

    const criar = await request(app.getHttpServer())
      .post('/api/comunidade/builds')
      .set('Cookie', cookieAutor)
      .send({
        titulo: `Build Interações ${sufixo}`,
        visibilidade: 'PUBLICA',
        componentes: componentesValidos,
      });

    expect(criar.status).toBe(201);
    buildId = (criar.body as { id: number }).id;

    const publicar = await request(app.getHttpServer())
      .patch(`/api/comunidade/builds/${buildId}`)
      .set('Cookie', cookieAutor)
      .send({ status: 'PUBLICADA' });

    expect(publicar.status).toBe(200);
  });

  afterAll(async () => {
    if (prisma && buildId) {
      await prisma.buildComunidade.deleteMany({ where: { id: buildId } });
    }
    if (prisma) {
      await prisma.usuario.deleteMany({
        where: { id: { in: [autorId, outroId].filter(Boolean) } },
      });
    }
    if (app) await app.close();
  });

  it('avaliação exige sessão', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/comunidade/builds/${buildId}/avaliacao`)
      .send({ nota: 5 });

    expect(res.status).toBe(401);
  });

  it('nota deve estar entre 1 e 5', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/comunidade/builds/${buildId}/avaliacao`)
      .set('Cookie', cookieAutor)
      .send({ nota: 6 });

    expect(res.status).toBe(400);
  });

  it('mantém uma avaliação imutável por usuário e calcula média', async () => {
    const primeira = await request(app.getHttpServer())
      .post(`/api/comunidade/builds/${buildId}/avaliacao`)
      .set('Cookie', cookieAutor)
      .send({ nota: 5 });
    expect(primeira.status).toBe(201);
    expect(primeira.body.quantidadeAvaliacoes).toBe(1);
    expect(primeira.body.mediaAvaliacoes).toBe(5);

    const segunda = await request(app.getHttpServer())
      .post(`/api/comunidade/builds/${buildId}/avaliacao`)
      .set('Cookie', cookieOutro)
      .send({ nota: 3 });
    expect(segunda.status).toBe(201);
    expect(segunda.body.quantidadeAvaliacoes).toBe(2);
    expect(segunda.body.mediaAvaliacoes).toBe(4);

    const atualizar = await request(app.getHttpServer())
      .post(`/api/comunidade/builds/${buildId}/avaliacao`)
      .set('Cookie', cookieAutor)
      .send({ nota: 4 });
    expect(atualizar.status).toBe(409);

    const quantidadeNoBanco = await prisma.avaliacaoBuild.count({
      where: { buildId, usuarioId: autorId },
    });
    expect(quantidadeNoBanco).toBe(1);
  });

  it('detalhe da build retorna média e quantidade de avaliações', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/comunidade/builds/${buildId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.mediaAvaliacoes).toBe(4);
    expect(res.body.quantidadeAvaliacoes).toBe(2);
  });

  it('cria comentário e resposta com somente dois níveis', async () => {
    const comentario = await request(app.getHttpServer())
      .post(`/api/comunidade/builds/${buildId}/comentarios`)
      .set('Cookie', cookieAutor)
      .send({ texto: 'Comentário principal.' });

    expect(comentario.status).toBe(201);
    comentarioId = (comentario.body as { id: number }).id;
    expect(comentario.body.usuarioId).toBe(autorId);

    const resposta = await request(app.getHttpServer())
      .post(`/api/comunidade/builds/${buildId}/comentarios`)
      .set('Cookie', cookieOutro)
      .send({
        texto: 'Resposta ao comentário.',
        comentarioPaiId: comentarioId,
      });

    expect(resposta.status).toBe(201);
    respostaId = (resposta.body as { id: number }).id;
    expect(resposta.body.comentarioPaiId).toBe(comentarioId);

    const terceiroNivel = await request(app.getHttpServer())
      .post(`/api/comunidade/builds/${buildId}/comentarios`)
      .set('Cookie', cookieAutor)
      .send({
        texto: 'Não deve ser permitido.',
        comentarioPaiId: respostaId,
      });

    expect(terceiroNivel.status).toBe(400);
  });

  it('somente o autor edita o texto do comentário', async () => {
    const negado = await request(app.getHttpServer())
      .patch(`/api/comunidade/comentarios/${comentarioId}`)
      .set('Cookie', cookieOutro)
      .send({ texto: 'Tentativa indevida.' });
    expect(negado.status).toBe(403);

    const alterado = await request(app.getHttpServer())
      .patch(`/api/comunidade/comentarios/${comentarioId}`)
      .set('Cookie', cookieAutor)
      .send({ texto: 'Comentário principal editado.' });
    expect(alterado.status).toBe(200);
    expect(alterado.body.texto).toBe('Comentário principal editado.');
  });

  it('ADMIN pode ocultar comentário', async () => {
    const extra = await request(app.getHttpServer())
      .post(`/api/comunidade/builds/${buildId}/comentarios`)
      .set('Cookie', cookieOutro)
      .send({ texto: 'Comentário para moderação.' });
    expect(extra.status).toBe(201);
    const extraId = (extra.body as { id: number }).id;

    const usuarioNaoPode = await request(app.getHttpServer())
      .patch(`/api/comunidade/comentarios/${extraId}`)
      .set('Cookie', cookieOutro)
      .send({ status: 'OCULTO' });
    expect(usuarioNaoPode.status).toBe(403);

    const moderado = await request(app.getHttpServer())
      .patch(`/api/comunidade/comentarios/${extraId}`)
      .set('Cookie', cookieAdmin)
      .send({ status: 'OCULTO' });
    expect(moderado.status).toBe(200);
    expect(moderado.body.status).toBe('OCULTO');

    const lista = await request(app.getHttpServer()).get(
      `/api/comunidade/builds/${buildId}/comentarios`,
    );
    expect(lista.status).toBe(200);
    expect(
      lista.body.comentarios.some(
        (item: { id: number }) => item.id === extraId,
      ),
    ).toBe(false);
  });

  it('DELETE é soft delete e preserva respostas com texto do pai ocultado', async () => {
    const remover = await request(app.getHttpServer())
      .delete(`/api/comunidade/comentarios/${comentarioId}`)
      .set('Cookie', cookieAutor);

    expect(remover.status).toBe(200);
    expect(remover.body.status).toBe('REMOVIDO');
    expect(remover.body.removido).toBe(true);

    const lista = await request(app.getHttpServer()).get(
      `/api/comunidade/builds/${buildId}/comentarios`,
    );
    expect(lista.status).toBe(200);

    const pai = lista.body.comentarios.find(
      (item: { id: number }) => item.id === comentarioId,
    );
    expect(pai).toBeDefined();
    expect(pai.texto).toBeNull();
    expect(pai.removido).toBe(true);
    expect(
      pai.respostas.some((item: { id: number }) => item.id === respostaId),
    ).toBe(true);
  });
});
