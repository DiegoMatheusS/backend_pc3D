import * as argon2 from 'argon2';
import request from 'supertest';
import {
  CategoriaHardware,
  GrupoCategoriaProduto,
  PapelUsuario,
  TipoProduto,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';

describe('Sugestões de ofertas por usuários (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let cookieUsuario: string;
  let usuarioId: number;
  let categoriaProdutoId: number;
  let produtoId: number;
  let hardwareId: number;
  let parceiroId: number;
  const sugestoesCriadas: number[] = [];
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailUsuario = `sugestao.oferta.${sufixo}@example.com`;
  const senhaUsuario = 'SugestaoE2E@123456';

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);

    const senhaHash = await argon2.hash(senhaUsuario, {
      type: argon2.argon2id,
    });
    const usuario = await prisma.usuario.create({
      data: {
        nome: `Usuário Sugestão ${sufixo}`,
        email: emailUsuario,
        senhaHash,
        papel: PapelUsuario.USUARIO,
        ativo: true,
      },
    });
    usuarioId = usuario.id;

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: emailUsuario, senha: senhaUsuario });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'];
    cookieUsuario = Array.isArray(cookie) ? cookie[0] : cookie;

    const categoriaProduto = await prisma.categoriaProduto.create({
      data: {
        nome: `Memória RAM Sugestão ${sufixo}`,
        slug: `memoria-ram-sugestao-${sufixo}`,
        grupo: GrupoCategoriaProduto.COMPONENTES,
        ativo: true,
      },
    });
    categoriaProdutoId = categoriaProduto.id;

    const produto = await prisma.produto.create({
      data: {
        categoriaId: categoriaProdutoId,
        tipo: TipoProduto.HARDWARE,
        nome: `Memória RAM E2E ${sufixo}`,
        slug: `memoria-ram-e2e-${sufixo}`,
        marca: 'CriaByte E2E',
        modelo: `RAM-${sufixo}`,
        ativo: true,
        publicado: true,
      },
    });
    produtoId = produto.id;

    const hardware = await prisma.hardware.create({
      data: {
        produtoId,
        nome: `Hardware RAM E2E ${sufixo}`,
        slug: `hardware-ram-e2e-${sufixo}`,
        categoria: CategoriaHardware.MEMORIA_RAM,
        marca: 'CriaByte E2E',
        modelo: `HW-RAM-${sufixo}`,
        ativo: true,
        publicado: true,
      },
    });
    hardwareId = hardware.id;

    const parceiro = await prisma.parceiro.create({
      data: {
        nome: `Parceiro Sugestão ${sufixo}`,
        slug: `parceiro-sugestao-${sufixo}`,
        dominio: `ofertas-${sufixo}.example.com`,
        programaAfiliados: true,
        ativo: true,
      },
    });
    parceiroId = parceiro.id;
  });

  afterAll(async () => {
    if (prisma) {
      if (usuarioId) {
        await prisma.$executeRaw`
          DELETE FROM "sugestoes_ofertas" WHERE "usuario_id" = ${usuarioId}
        `;
      }
      if (produtoId) {
        await prisma.produto.deleteMany({ where: { id: produtoId } });
      }
      if (parceiroId) {
        await prisma.parceiro.deleteMany({ where: { id: parceiroId } });
      }
      if (categoriaProdutoId) {
        await prisma.categoriaProduto.deleteMany({
          where: { id: categoriaProdutoId },
        });
      }
      if (usuarioId) {
        await prisma.usuario.deleteMany({ where: { id: usuarioId } });
      }
    }
    if (app) await app.close();
  });

  it('exige login para enviar sugestão', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ofertas/sugestoes')
      .send({
        nome: 'Memória sem login',
        urlOriginal: `https://ofertas-${sufixo}.example.com/sem-login`,
        categoria: 'MEMORIA_RAM',
        preco: 499,
      });

    expect(res.status).toBe(401);
  });

  it('expõe campos dinâmicos por categoria para o formulário', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ofertas/sugestoes/campos')
      .set('Cookie', cookieUsuario);

    expect(res.status).toBe(200);
    const memoria = res.body.categorias.find(
      (item: { categoria: string }) => item.categoria === 'MEMORIA_RAM',
    );
    expect(memoria).toBeDefined();
    expect(memoria.campos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chave: 'capacidadeGb', unidade: 'GB' }),
        expect.objectContaining({ chave: 'frequenciaMtS' }),
      ]),
    );

    const celular = res.body.categorias.find(
      (item: { categoria: string }) => item.categoria === 'CELULAR',
    );
    expect(celular).toBeDefined();
    expect(celular.campos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chave: 'armazenamentoGb', unidade: 'GB' }),
        expect.objectContaining({ chave: 'bateriaMah', unidade: 'mAh' }),
        expect.objectContaining({ chave: 'rede5g', tipo: 'booleano' }),
      ]),
    );
  });

  it('usuário envia link + categoria + especificações e sugestão nasce EM_ANALISE', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ofertas/sugestoes')
      .set('Cookie', cookieUsuario)
      .send({
        nome: `Kit DDR5 ${sufixo}`,
        urlOriginal: `https://ofertas-${sufixo}.example.com/kit-ddr5`,
        categoria: 'MEMORIA_RAM',
        preco: 599.9,
        precoAnterior: 699.9,
        especificacoes: {
          capacidadeGb: 32,
          tipoMemoria: 'DDR5',
          frequenciaMtS: 6000,
          modulos: 2,
          latenciaCl: 30,
        },
        observacao: 'Oferta encontrada pelo usuário.',
      });

    expect(res.status).toBe(201);
    sugestoesCriadas.push(res.body.id);
    expect(res.body).toMatchObject({
      status: 'EM_ANALISE',
      categoria: 'MEMORIA_RAM',
      preco: 599.9,
      parceiro: { id: parceiroId },
    });
    expect(res.body.especificacoes).toMatchObject({
      capacidadeGb: 32,
      frequenciaMtS: 6000,
    });
  });

  it('rejeita campo técnico que não pertence à categoria', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ofertas/sugestoes')
      .set('Cookie', cookieUsuario)
      .send({
        nome: `RAM inválida ${sufixo}`,
        urlOriginal: `https://ofertas-${sufixo}.example.com/ram-invalida`,
        categoria: 'MEMORIA_RAM',
        preco: 450,
        especificacoes: { capacidadeGb: 16, leituraMbS: 7000 },
      });

    expect(res.status).toBe(400);
  });

  it('USUARIO não acessa fila administrativa', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/ofertas/sugestoes')
      .set('Cookie', cookieUsuario);

    expect(res.status).toBe(403);
  });

  it('ADMIN vê a fila e programa afiliado exige URL afiliada para aprovação', async () => {
    const sugestaoId = sugestoesCriadas[0];
    const lista = await request(app.getHttpServer())
      .get('/api/admin/ofertas/sugestoes?status=EM_ANALISE')
      .set('Cookie', cookieAdmin);

    expect(lista.status).toBe(200);
    expect(lista.body.sugestoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: sugestaoId, status: 'EM_ANALISE' }),
      ]),
    );

    const semAfiliado = await request(app.getHttpServer())
      .patch(`/api/admin/ofertas/sugestoes/${sugestaoId}/aprovar`)
      .set('Cookie', cookieAdmin)
      .send({ hardwareId, parceiroId });

    expect(semAfiliado.status).toBe(400);
  });

  it('ADMIN aprova e só então cria Oferta normal vinculada ao Produto', async () => {
    const sugestaoId = sugestoesCriadas[0];
    const aprovar = await request(app.getHttpServer())
      .patch(`/api/admin/ofertas/sugestoes/${sugestaoId}/aprovar`)
      .set('Cookie', cookieAdmin)
      .send({
        hardwareId,
        parceiroId,
        urlAfiliada: `https://affiliate.example.com/${sufixo}`,
        observacao: 'Dados conferidos pelo admin.',
      });

    expect(aprovar.status).toBe(200);
    expect(aprovar.body.sugestao.status).toBe('APROVADA');
    expect(aprovar.body.oferta).toMatchObject({
      produtoId,
      hardwareId,
      parceiroId,
      status: 'ATIVA',
    });

    const oferta = await prisma.oferta.findUnique({
      where: { id: aprovar.body.oferta.id },
    });
    expect(oferta).not.toBeNull();
    expect(oferta?.urlAfiliada).toBe(`https://affiliate.example.com/${sufixo}`);
    expect(oferta?.usuarioOrigemId).toBe(usuarioId);

    const produtoComOrigem = await prisma.produto.findUnique({
      where: { id: produtoId },
      select: { usuarioOrigemId: true },
    });
    expect(produtoComOrigem?.usuarioOrigemId).toBe(usuarioId);

    const repetir = await request(app.getHttpServer())
      .patch(`/api/admin/ofertas/sugestoes/${sugestaoId}/aprovar`)
      .set('Cookie', cookieAdmin)
      .send({
        hardwareId,
        parceiroId,
        urlAfiliada: `https://affiliate.example.com/${sufixo}`,
      });
    expect(repetir.status).toBe(409);
  });

  it('ADMIN aceita Oferta existente selecionando o Produto e preserva o usuário como Cadastrado por', async () => {
    await prisma.produto.update({
      where: { id: produtoId },
      data: { usuarioOrigemId: null },
    });

    const urlOriginal = `https://ofertas-${sufixo}.example.com/oferta-existente`;
    const criarSugestao = await request(app.getHttpServer())
      .post('/api/ofertas/sugestoes')
      .set('Cookie', cookieUsuario)
      .send({
        nome: `RAM oferta existente ${sufixo}`,
        urlOriginal,
        categoria: 'MEMORIA_RAM',
        preco: 549.9,
        especificacoes: {
          capacidadeGb: 32,
          tipoMemoria: 'DDR5',
          frequenciaMtS: 6000,
        },
      });

    expect(criarSugestao.status).toBe(201);
    sugestoesCriadas.push(criarSugestao.body.id);

    const criarOferta = await request(app.getHttpServer())
      .post('/api/admin/ofertas')
      .set('Cookie', cookieAdmin)
      .send({
        produtoId,
        parceiroId,
        urlOriginal,
        urlAfiliada: `https://affiliate.example.com/existente-${sufixo}`,
        preco: 549.9,
      });

    expect(criarOferta.status).toBe(201);
    const ofertaId = criarOferta.body.id;

    const quantidadeAntes = await prisma.oferta.count({
      where: { produtoId },
    });

    const aceitar = await request(app.getHttpServer())
      .patch(
        `/api/admin/ofertas/sugestoes/${criarSugestao.body.id}/aceitar-existente`,
      )
      .set('Cookie', cookieAdmin)
      .send({ produtoId });

    expect(aceitar.status).toBe(200);
    expect(aceitar.body.sugestao).toMatchObject({
      id: criarSugestao.body.id,
      status: 'APROVADA',
      ofertaId,
      produto: { id: produtoId },
    });
    expect(aceitar.body.oferta).toMatchObject({
      id: ofertaId,
      produtoId,
      cadastradoPor: { id: usuarioId },
    });

    const quantidadeDepois = await prisma.oferta.count({
      where: { produtoId },
    });
    expect(quantidadeDepois).toBe(quantidadeAntes);

    const [ofertaBanco, produtoBanco] = await Promise.all([
      prisma.oferta.findUnique({
        where: { id: ofertaId },
        select: { usuarioOrigemId: true },
      }),
      prisma.produto.findUnique({
        where: { id: produtoId },
        select: { usuarioOrigemId: true },
      }),
    ]);
    expect(ofertaBanco?.usuarioOrigemId).toBe(usuarioId);
    expect(produtoBanco?.usuarioOrigemId).toBe(usuarioId);

    const publico = await request(app.getHttpServer()).get(
      `/api/ofertas/produto/${produtoId}`,
    );
    expect(publico.status).toBe(200);
    expect(publico.body.produto.cadastradoPor).toMatchObject({
      id: usuarioId,
    });
    expect(
      publico.body.ofertas.find((item: { id: number }) => item.id === ofertaId)
        ?.cadastradoPor,
    ).toMatchObject({ id: usuarioId });
  });

  it('ADMIN pode rejeitar outra sugestão sem criar Oferta', async () => {
    const criar = await request(app.getHttpServer())
      .post('/api/ofertas/sugestoes')
      .set('Cookie', cookieUsuario)
      .send({
        nome: `Kit DDR5 rejeitado ${sufixo}`,
        urlOriginal: `https://ofertas-${sufixo}.example.com/rejeitar`,
        categoria: 'MEMORIA_RAM',
        preco: 999,
        especificacoes: { capacidadeGb: 32, frequenciaMtS: 6000 },
      });

    expect(criar.status).toBe(201);
    sugestoesCriadas.push(criar.body.id);

    const rejeitar = await request(app.getHttpServer())
      .patch(`/api/admin/ofertas/sugestoes/${criar.body.id}/rejeitar`)
      .set('Cookie', cookieAdmin)
      .send({ motivo: 'Preço e anúncio não puderam ser confirmados.' });

    expect(rejeitar.status).toBe(200);
    expect(rejeitar.body.status).toBe('REJEITADA');
    expect(rejeitar.body.analise.motivo).toContain(
      'não puderam ser confirmados',
    );

    const minhas = await request(app.getHttpServer())
      .get('/api/ofertas/sugestoes/minhas')
      .set('Cookie', cookieUsuario);
    expect(minhas.status).toBe(200);
    expect(minhas.body.sugestoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: criar.body.id, status: 'REJEITADA' }),
      ]),
    );
  });
});
