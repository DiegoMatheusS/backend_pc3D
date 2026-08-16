import request from 'supertest';
import {
  GrupoCategoriaProduto,
  StatusOferta,
  TipoProduto,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  componentesBuildFixture,
  criarFixturePcCompleto,
  limparFixturePcCompleto,
} from './fixtures/pc-completo.fixture';
import { App, criarApp, loginAdmin } from './app-setup';

jest.setTimeout(30000);

describe('Builds da Comunidade (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let cookieAutor: string;
  let cookieOutroUsuario: string;
  let autorId: number;
  let outroUsuarioId: number;
  let buildId = 0;
  let buildIncompletaId = 0;

  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const senha = 'Comunidade@123456';
  const emailAutor = `comunidade.autor.${sufixo}@example.com`;
  const emailOutro = `comunidade.outro.${sufixo}@example.com`;

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
      .send({
        nome,
        email,
        senha,
      });

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

    autorId = await criarUsuario(emailAutor, `Autor Comunidade ${sufixo}`);
    outroUsuarioId = await criarUsuario(
      emailOutro,
      `Outro Comunidade ${sufixo}`,
    );

    cookieAutor = await login(emailAutor);
    cookieOutroUsuario = await login(emailOutro);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.buildComunidade.deleteMany({
        where: { usuarioId: { in: [autorId, outroUsuarioId] } },
      });
      await prisma.usuario.deleteMany({
        where: { id: { in: [autorId, outroUsuarioId] } },
      });
    }
    if (app) await app.close();
  });

  it('POST /api/comunidade/builds — sem sessão → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/comunidade/builds')
      .send({
        titulo: `Sem sessão ${sufixo}`,
        componentes: componentesValidos,
      });

    expect(res.status).toBe(401);
  });

  it('cria rascunho vazio sem exigir componentes', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/comunidade/builds')
      .set('Cookie', cookieAutor)
      .send({ titulo: `Rascunho vazio ${sufixo}` });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('RASCUNHO');
    expect(res.body.componentes).toHaveLength(0);
  });

  it('aceita peça externa e ignora hardwareId inexistente quando há snapshot', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/comunidade/builds')
      .set('Cookie', cookieAutor)
      .send({
        titulo: `Hardware opcional ${sufixo}`,
        componentes: [
          {
            hardwareId: 2147483000,
            categoria: 'PROCESSADOR',
            nome: 'Processador não cadastrado',
            marca: 'Marca externa',
            modelo: 'Modelo externo',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.componentes[0].hardwareId).toBeNull();
    expect(res.body.componentes[0].hardware).toBeNull();
    expect(res.body.componentes[0].nome).toBe('Processador não cadastrado');
  });

  it('não aceita usuarioId vindo do frontend', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/comunidade/builds')
      .set('Cookie', cookieAutor)
      .send({
        usuarioId: outroUsuarioId,
        titulo: `Tentativa ownership ${sufixo}`,
        componentes: componentesValidos,
      });

    expect(res.status).toBe(400);
  });

  it('cria build como RASCUNHO usando o usuário da sessão', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/comunidade/builds')
      .set('Cookie', cookieAutor)
      .send({
        titulo: `Build Comunidade E2E ${sufixo}`,
        descricao: 'Build de teste da comunidade.',
        finalidade: 'JOGOS',
        resolucao: '1080p',
        visibilidade: 'PUBLICA',
        componentes: componentesValidos,
      });

    expect(res.status).toBe(201);
    buildId = (res.body as { id: number }).id;
    expect(res.body.usuarioId).toBe(autorId);
    expect(res.body.status).toBe('RASCUNHO');
    expect(res.body.visibilidade).toBe('PUBLICA');
    expect(res.body.componentes).toHaveLength(9);
  });

  it('GET /api/comunidade/builds/minhas — lista somente as builds do autor', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/comunidade/builds/minhas')
      .set('Cookie', cookieAutor);

    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(
      res.body.builds.some((item: { id: number }) => item.id === buildId),
    ).toBe(true);
  });

  it('rascunho não pode ser aberto publicamente', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/comunidade/builds/${buildId}`,
    );

    expect(res.status).toBe(404);
  });

  it('outro usuário não pode editar a build', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/comunidade/builds/${buildId}`)
      .set('Cookie', cookieOutroUsuario)
      .send({ titulo: 'Tentativa de alteração indevida' });

    expect(res.status).toBe(403);
  });

  it('publica a build mesmo quando as peças não existem no catálogo', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/comunidade/builds/${buildId}`)
      .set('Cookie', cookieAutor)
      .send({ status: 'PUBLICADA' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PUBLICADA');
    expect(res.body.publicadoEm).not.toBeNull();
    expect(res.body.consumoNaPublicacao).toBeNull();
    expect(res.body.precoNaPublicacao).toBeNull();
    expect(res.body.compatibilidadePublicacao).toBeNull();
    expect(
      res.body.componentes.every(
        (item: { hardwareId: number | null }) => item.hardwareId === null,
      ),
    ).toBe(true);
  });

  it('build PUBLICA aparece na listagem pública', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/comunidade/builds?ordenar=RECENTES`,
    );

    expect(res.status).toBe(200);
    expect(
      res.body.dados.some((item: { id: number }) => item.id === buildId),
    ).toBe(true);
  });

  it('build NAO_LISTADA sai da listagem, mas continua acessível por link', async () => {
    const alterar = await request(app.getHttpServer())
      .patch(`/api/comunidade/builds/${buildId}`)
      .set('Cookie', cookieAutor)
      .send({ visibilidade: 'NAO_LISTADA' });

    expect(alterar.status).toBe(200);

    const lista = await request(app.getHttpServer()).get(
      '/api/comunidade/builds',
    );
    expect(
      lista.body.dados.some((item: { id: number }) => item.id === buildId),
    ).toBe(false);

    const detalhe = await request(app.getHttpServer()).get(
      `/api/comunidade/builds/${buildId}`,
    );
    expect(detalhe.status).toBe(200);
  });

  it('build PRIVADA só pode ser aberta pelo autor ou ADMIN', async () => {
    const alterar = await request(app.getHttpServer())
      .patch(`/api/comunidade/builds/${buildId}`)
      .set('Cookie', cookieAutor)
      .send({ visibilidade: 'PRIVADA' });
    expect(alterar.status).toBe(200);

    const publico = await request(app.getHttpServer()).get(
      `/api/comunidade/builds/${buildId}`,
    );
    expect(publico.status).toBe(404);

    const autor = await request(app.getHttpServer())
      .get(`/api/comunidade/builds/${buildId}`)
      .set('Cookie', cookieAutor);
    expect(autor.status).toBe(200);

    const admin = await request(app.getHttpServer())
      .get(`/api/comunidade/builds/${buildId}`)
      .set('Cookie', cookieAdmin);
    expect(admin.status).toBe(200);
  });

  it('bloqueia publicação de rascunho incompleto', async () => {
    const criar = await request(app.getHttpServer())
      .post('/api/comunidade/builds')
      .set('Cookie', cookieAutor)
      .send({
        titulo: `Build incompleta ${sufixo}`,
        componentes: [
          {
            nome: 'Processador incompleto E2E',
            categoria: 'PROCESSADOR',
            quantidade: 1,
          },
        ],
      });

    expect(criar.status).toBe(201);
    buildIncompletaId = (criar.body as { id: number }).id;

    const publicar = await request(app.getHttpServer())
      .patch(`/api/comunidade/builds/${buildIncompletaId}`)
      .set('Cookie', cookieAutor)
      .send({ status: 'PUBLICADA' });

    expect(publicar.status).toBe(400);
  });

  it('salva o preço total confiável das peças quando a build é publicada', async () => {
    const fixture = await criarFixturePcCompleto(prisma);
    const categoria = await prisma.categoriaProduto.create({
      data: {
        nome: `Componentes Comunidade Preço ${sufixo}`,
        slug: `componentes-comunidade-preco-${sufixo}`,
        grupo: GrupoCategoriaProduto.COMPONENTES,
        ativo: true,
      },
    });
    const parceiro = await prisma.parceiro.create({
      data: {
        nome: `Parceiro Comunidade Preço ${sufixo}`,
        slug: `parceiro-comunidade-preco-${sufixo}`,
        ativo: true,
      },
    });
    const hardwareIds = fixture.todosHardwareIds;
    const hardwares = await prisma.hardware.findMany({
      where: { id: { in: hardwareIds } },
      select: { id: true, nome: true },
      orderBy: { id: 'asc' },
    });
    const precos = new Map<number, number>();
    const produtoIds: number[] = [];
    let buildPrecoId = 0;

    try {
      for (const [indice, hardware] of hardwares.entries()) {
        const preco = (indice + 1) * 100;
        precos.set(hardware.id, preco);
        const produto = await prisma.produto.create({
          data: {
            categoriaId: categoria.id,
            tipo: TipoProduto.HARDWARE,
            nome: `Produto ${hardware.nome}`,
            slug: `produto-comunidade-preco-${hardware.id}-${sufixo}`,
            publicado: true,
            ativo: true,
          },
        });
        produtoIds.push(produto.id);
        await prisma.hardware.update({
          where: { id: hardware.id },
          data: { produtoId: produto.id },
        });
        await prisma.oferta.create({
          data: {
            produtoId: produto.id,
            hardwareId: hardware.id,
            parceiroId: parceiro.id,
            urlOriginal: `https://example.com/hardware-${hardware.id}-${sufixo}`,
            preco,
            status: StatusOferta.ATIVA,
          },
        });
      }

      const componentes = componentesBuildFixture(fixture);
      const esperado = componentes.reduce((total, componente) => {
        const preco = precos.get(componente.hardwareId) ?? 0;
        return total + preco * componente.quantidade;
      }, 0);

      const criar = await request(app.getHttpServer())
        .post('/api/comunidade/builds')
        .set('Cookie', cookieAutor)
        .send({
          titulo: `Build com preço histórico ${sufixo}`,
          visibilidade: 'PUBLICA',
          componentes,
        });
      expect(criar.status).toBe(201);
      buildPrecoId = (criar.body as { id: number }).id;

      const publicar = await request(app.getHttpServer())
        .patch(`/api/comunidade/builds/${buildPrecoId}`)
        .set('Cookie', cookieAutor)
        .send({ status: 'PUBLICADA' });

      expect(publicar.status).toBe(200);
      expect(Number(publicar.body.precoNaPublicacao)).toBe(esperado);

      const salvo = await prisma.buildComunidade.findUnique({
        where: { id: buildPrecoId },
        select: { precoNaPublicacao: true },
      });
      expect(Number(salvo?.precoNaPublicacao)).toBe(esperado);
    } finally {
      if (buildPrecoId) {
        await prisma.buildComunidade.deleteMany({
          where: { id: buildPrecoId },
        });
      }
      if (produtoIds.length > 0) {
        await prisma.produto.deleteMany({ where: { id: { in: produtoIds } } });
      }
      await prisma.parceiro.deleteMany({ where: { id: parceiro.id } });
      await prisma.categoriaProduto.deleteMany({ where: { id: categoria.id } });
      await limparFixturePcCompleto(prisma, fixture);
    }
  });

  it('DELETE faz soft delete e remove a build de minhas builds', async () => {
    const excluir = await request(app.getHttpServer())
      .delete(`/api/comunidade/builds/${buildId}`)
      .set('Cookie', cookieAutor);

    expect(excluir.status).toBe(200);
    expect(excluir.body.status).toBe('REMOVIDA');
    expect(excluir.body.removida).toBe(true);

    const minhas = await request(app.getHttpServer())
      .get('/api/comunidade/builds/minhas')
      .set('Cookie', cookieAutor);

    expect(
      minhas.body.builds.some((item: { id: number }) => item.id === buildId),
    ).toBe(false);
  });
});
