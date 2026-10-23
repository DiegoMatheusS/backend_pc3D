import { randomBytes } from 'node:crypto';
import request from 'supertest';
import * as argon2 from 'argon2';
import { TOTP, Secret } from 'otpauth';
import { criarApp, type App } from './app-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { AccountSecurityService } from '../src/auth/account-security.service';
import { PersistentLimits } from '../src/auth/persistent-limits.module';
import { PapelUsuario } from '../src/generated/prisma/enums';

describe('cadastro de PC, builds na conta e autenticação', () => {
  let app: App, prisma: PrismaService;
  const ids: number[] = [],
    cookies: string[] = [];
  const emails: string[] = [];
  const password = 'TesteSeguro@2026';
  const suffix = randomBytes(6).toString('hex');
  beforeAll(async () => {
    process.env.AUTH_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    app = await criarApp();
    prisma = app.get(PrismaService);
    for (let i = 0; i < 3; i++) {
      const email = `platform-${i}-${suffix}@example.test`;
      const user = await prisma.usuario.create({
        data: {
          nome: `Conta ${i}`,
          email,
          senhaHash: await argon2.hash(password),
          papel: i === 0 ? PapelUsuario.ADMIN : PapelUsuario.USUARIO,
        },
      });
      ids.push(user.id);
      emails.push(email);
      const session = await app
        .get(AuthService)
        .login({ email, senha: password });
      if ('requires2fa' in session)
        throw new Error('Conta de teste inesperadamente protegida.');
      cookies.push(`pcbuilder_session=${session.token}`);
    }
  }, 30000);
  afterAll(async () => {
    if (app) {
      await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
      await app.close();
    }
  });

  it('PC completo cadastra a oferta mesmo sem peças vinculadas', async () => {
    const partner = await prisma.parceiro.create({
      data: {
        nome: 'Loja QA',
        slug: `loja-${suffix}`,
        dominio: 'loja.example',
        ativo: true,
      },
    });
    const response = await request(app.getHttpServer())
      .post('/api/admin/builds')
      .set('Cookie', cookies[0])
      .send({
        nome: `PC completo QA ${suffix}`,
        descricao: 'Ryzen 5600G, 16 GB RAM, SSD 512 GB; teclado e mouse.',
        publicado: true,
        componentes: [],
        ofertas: [
          {
            parceiroId: partner.id,
            preco: 2399.9,
            urlOriginal: `https://loja.example/pc-${suffix}`,
            urlAfiliada: `https://loja.example/afiliado-${suffix}`,
          },
        ],
      })
      .expect(201);
    expect(response.body.produto.ofertas).toHaveLength(1);
    expect(response.body.componentes).toEqual([]);
    const id = response.body.produtoId as number;
    await prisma.build.delete({ where: { id: response.body.id as number } });
    await prisma.produto.delete({ where: { id } });
    await prisma.parceiro.delete({ where: { id: partner.id } });
  });

  it('cadastro e edição persistem o nome técnico sem o texto promocional', async () => {
    const existing = await prisma.categoriaProduto.findUnique({
      where: { slug: 'mouses' },
    });
    const category =
      existing ??
      (await prisma.categoriaProduto.create({
        data: { nome: 'Mouses', slug: 'mouses', ativo: true },
      }));
    let productId: number | undefined;
    try {
      const created = await request(app.getHttpServer())
        .post('/api/admin/produtos')
        .set('Cookie', cookies[0])
        .send({
          categoriaId: category.id,
          nome: 'Mouse Logitech G502 HERO foi desenvolvido para vencer.',
          marca: 'Logitech',
          modelo: `G502 HERO QA ${suffix}`,
          descricao: 'DPI máximo: 25600; conexão USB.',
          publicado: false,
        })
        .expect(201);
      productId = created.body.id as number;
      expect(created.body.nome).toBe('Mouse Logitech G502 HERO');
      await request(app.getHttpServer())
        .patch(`/api/admin/produtos/${productId}`)
        .set('Cookie', cookies[0])
        .send({ nome: 'Mouse Logitech G502 HERO. Descubra toda a história.' })
        .expect(200);
      const saved = await prisma.produto.findUniqueOrThrow({
        where: { id: productId },
      });
      expect(saved.nome).toBe('Mouse Logitech G502 HERO');
      expect(saved.descricao).toBe('DPI máximo: 25600; conexão USB.');
    } finally {
      if (productId) await prisma.produto.delete({ where: { id: productId } });
      if (!existing)
        await prisma.categoriaProduto.delete({ where: { id: category.id } });
    }
  });

  it('build salva pertence à conta, aparece em nova sessão e recusa sobrescrita antiga', async () => {
    const path = '/api/builds-pessoais/build-qa';
    const body = {
      dados: {
        nome: 'Minha build',
        configuracao: { processador: { id: 1, nome: 'CPU' } },
      },
    };
    const saved = await request(app.getHttpServer())
      .put(path)
      .set('Cookie', cookies[1])
      .set('X-CriaByte-Account', emails[1])
      .send(body)
      .expect(200);
    expect(saved.body.revisao).toBe(1);
    const repeated = await request(app.getHttpServer())
      .put(path)
      .set('Cookie', cookies[1])
      .set('X-CriaByte-Account', emails[1])
      .send(body)
      .expect(200);
    expect(repeated.body.revisao).toBe(1);
    const list = await request(app.getHttpServer())
      .get('/api/builds-pessoais')
      .set('Cookie', cookies[1])
      .set('X-CriaByte-Account', emails[1])
      .expect(200);
    expect(list.body[0].nome).toBe('Minha build');
    const other = await request(app.getHttpServer())
      .get('/api/builds-pessoais')
      .set('Cookie', cookies[2])
      .set('X-CriaByte-Account', emails[2])
      .expect(200);
    expect(other.body).toEqual([]);
    await request(app.getHttpServer())
      .delete(path)
      .set('Cookie', cookies[2])
      .set('X-CriaByte-Account', emails[2])
      .expect(200);
    await request(app.getHttpServer())
      .put(path)
      .set('Cookie', cookies[1])
      .set('X-CriaByte-Account', emails[1])
      .send({
        dados: { ...body.dados, nome: 'Atualizada no outro aparelho' },
        revisao: 1,
      })
      .expect(200);
    await request(app.getHttpServer())
      .put(path)
      .set('Cookie', cookies[1])
      .set('X-CriaByte-Account', emails[1])
      .send({ ...body, revisao: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .delete(path)
      .set('Cookie', cookies[1])
      .set('X-CriaByte-Account', emails[1])
      .send({ revisao: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .get('/api/builds-pessoais')
      .set('Cookie', cookies[1])
      .set('X-CriaByte-Account', emails[2])
      .expect(403);
    await request(app.getHttpServer()).get('/api/builds-pessoais').expect(401);
  });

  it('2FA guarda segredo criptografado, exige segundo fator e consome recuperação uma vez', async () => {
    const security = app.get(AccountSecurityService);
    const setup = await security.setup(ids[2], password);
    const olderSetup = await security.setup(ids[2], password);
    const code = new TOTP({
      secret: Secret.fromBase32(setup.segredo),
    }).generate();
    const activated = await security.activate(ids[2], setup.desafio, code);
    await expect(
      security.activate(
        ids[2],
        olderSetup.desafio,
        new TOTP({
          secret: Secret.fromBase32(olderSetup.segredo),
        }).generate(),
      ),
    ).rejects.toThrow();
    expect(
      (
        await prisma.segurancaConta.findUniqueOrThrow({
          where: { usuarioId: ids[2] },
        })
      ).segredo,
    ).not.toContain(setup.segredo);
    const user = await prisma.usuario.findUniqueOrThrow({
      where: { id: ids[2] },
    });
    const challenge = await app
      .get(AuthService)
      .login({ email: user.email, senha: password });
    expect(challenge).toHaveProperty('requires2fa', true);
    if (!('desafio' in challenge)) throw new Error('Sem desafio');
    expect(
      await security.complete(
        challenge.desafio,
        activated.codigosRecuperacao[0],
      ),
    ).toBe(ids[2]);
    await expect(
      security.complete(challenge.desafio, activated.codigosRecuperacao[0]),
    ).rejects.toThrow();
    expect((await security.status(ids[2])).codigosRestantes).toBe(7);
  });

  it('novos desafios não reiniciam o limite de tentativas do segundo fator', async () => {
    const security = app.get(AccountSecurityService);
    const limits = app.get(PersistentLimits);
    for (let i = 0; i < 10; i++) {
      const challenge = await security.challenge(ids[2]);
      if (!challenge) throw new Error('Segundo fator esperado');
      await expect(
        security.complete(
          challenge.desafio,
          '00000000000000000000000000000000',
        ),
      ).rejects.toThrow('Código inválido');
    }
    const challenge = await security.challenge(ids[2]);
    if (!challenge) throw new Error('Segundo fator esperado');
    await expect(
      security.complete(challenge.desafio, '00000000000000000000000000000000'),
    ).rejects.toThrow('Muitas tentativas');
    await limits.clear(`mfa:${ids[2]}`);
  });

  it('recuperação é temporária, de uso único e revoga sessões', async () => {
    const security = app.get(AccountSecurityService);
    const token = await security.token(ids[1], 'RESET', 60);
    await security.reset(token, 'NovaSenha@2026');
    await expect(security.reset(token, 'OutraSenha@2026')).rejects.toThrow();
    expect(
      await prisma.sessao.count({
        where: { usuarioId: ids[1], revogadaEm: null },
      }),
    ).toBe(0);
  });

  it('limite de tentativas permanece ao recriar o serviço', async () => {
    const key = `qa-${suffix}`;
    const first = new PersistentLimits(prisma);
    await first.increment(key, 60000, 2, 60000);
    await first.increment(key, 60000, 2, 60000);
    expect((await first.increment(key, 60000, 2, 60000)).isBlocked).toBe(true);
    expect(await new PersistentLimits(prisma).blocked(key)).toBe(true);
    await first.clear(key);
  });
});
