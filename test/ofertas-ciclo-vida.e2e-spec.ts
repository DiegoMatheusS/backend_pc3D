import request from 'supertest';
import {
  CategoriaHardware,
  GrupoCategoriaProduto,
  StatusOferta,
  TipoProduto,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { OfertasService } from '../src/ofertas/ofertas.service';
import { App, criarApp, loginAdmin } from './app-setup';

describe('Ofertas — integridade e histórico (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let categoriaId: number;
  let produtoId: number;
  let hardwareId: number;
  let parceiroBaseId: number;
  const parceirosExtras: number[] = [];
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);

    const categoria = await prisma.categoriaProduto.create({
      data: {
        nome: `Categoria Oferta E2E ${sufixo}`,
        slug: `categoria-oferta-e2e-${sufixo}`,
        grupo: GrupoCategoriaProduto.COMPONENTES,
        ativo: true,
      },
    });
    categoriaId = categoria.id;

    const produto = await prisma.produto.create({
      data: {
        categoriaId,
        tipo: TipoProduto.HARDWARE,
        nome: `Produto Oferta E2E ${sufixo}`,
        slug: `produto-oferta-e2e-${sufixo}`,
        marca: 'CriaByte E2E',
        modelo: `OF-${sufixo}`,
        ativo: true,
        publicado: true,
      },
    });
    produtoId = produto.id;

    const hardware = await prisma.hardware.create({
      data: {
        produtoId,
        nome: `Hardware Oferta E2E ${sufixo}`,
        slug: `hardware-oferta-e2e-${sufixo}`,
        categoria: CategoriaHardware.PROCESSADOR,
        marca: 'CriaByte E2E',
        modelo: `HW-${sufixo}`,
        ativo: true,
        publicado: true,
      },
    });
    hardwareId = hardware.id;

    const parceiro = await prisma.parceiro.create({
      data: {
        nome: `Parceiro Base E2E ${sufixo}`,
        slug: `parceiro-base-e2e-${sufixo}`,
        dominio: `base-${sufixo}.example.com`,
        ativo: true,
        programaAfiliados: true,
      },
    });
    parceiroBaseId = parceiro.id;
  });

  afterAll(async () => {
    if (prisma) {
      if (produtoId) {
        await prisma.produto.deleteMany({ where: { id: produtoId } });
      }
      const parceiroIds = [parceiroBaseId, ...parceirosExtras].filter(Boolean);
      if (parceiroIds.length > 0) {
        await prisma.parceiro.deleteMany({
          where: { id: { in: parceiroIds } },
        });
      }
      if (categoriaId) {
        await prisma.categoriaProduto.deleteMany({
          where: { id: categoriaId },
        });
      }
    }
    if (app) await app.close();
  });

  it('normaliza parceiro, permite limpar opcionais e bloqueia domínio duplicado', async () => {
    const dominioA = `LOJA-A-${sufixo}.EXAMPLE.COM`;
    const parceiroA = await request(app.getHttpServer())
      .post('/api/admin/ofertas/parceiros')
      .set('Cookie', cookieAdmin)
      .send({
        nome: `Loja A ${sufixo}`,
        dominio: dominioA,
        site: 'https://example.com',
        logoUrl: 'https://example.com/logo.png',
        observacao: 'Teste',
      });

    expect(parceiroA.status).toBe(201);
    expect(parceiroA.body.dominio).toBe(dominioA.toLowerCase());
    parceirosExtras.push(parceiroA.body.id);

    const parceiroB = await request(app.getHttpServer())
      .post('/api/admin/ofertas/parceiros')
      .set('Cookie', cookieAdmin)
      .send({
        nome: `Loja B ${sufixo}`,
        dominio: `loja-b-${sufixo}.example.com`,
      });

    expect(parceiroB.status).toBe(201);
    parceirosExtras.push(parceiroB.body.id);

    const conflito = await request(app.getHttpServer())
      .patch(`/api/admin/ofertas/parceiros/${parceiroB.body.id}`)
      .set('Cookie', cookieAdmin)
      .send({ dominio: dominioA.toLowerCase() });

    expect(conflito.status).toBe(409);

    const limpar = await request(app.getHttpServer())
      .patch(`/api/admin/ofertas/parceiros/${parceiroB.body.id}`)
      .set('Cookie', cookieAdmin)
      .send({
        dominio: null,
        site: null,
        logoUrl: null,
        observacao: null,
      });

    expect(limpar.status).toBe(200);
    expect(limpar.body.dominio).toBeNull();
    expect(limpar.body.site).toBeNull();
    expect(limpar.body.logoUrl).toBeNull();
    expect(limpar.body.observacao).toBeNull();
  });

  it('resolve POST /admin/ofertas/verificar-precos como rota estática', async () => {
    const ofertasService = app.get(OfertasService);
    const verificarSpy = jest
      .spyOn(ofertasService, 'verificarPrecosOfertas')
      .mockResolvedValue({
        totalProcessadas: 0,
        totalAtualizadas: 0,
        totalSemAlteracao: 0,
        totalRevisar: 0,
        totalBloqueadas: 0,
        totalErros: 0,
        totalIndisponiveis: 0,
        totalElegiveisAntes: 0,
        resultados: [],
      } as Awaited<ReturnType<OfertasService['verificarPrecosOfertas']>>);

    try {
      const res = await request(app.getHttpServer())
        .post('/api/admin/ofertas/verificar-precos')
        .set('Cookie', cookieAdmin)
        .send({ limite: 50 });

      expect(res.status).toBe(200);
      expect(verificarSpy).toHaveBeenCalledWith(50);
      expect(res.body).toMatchObject({ totalProcessadas: 0, resultados: [] });
    } finally {
      verificarSpy.mockRestore();
    }
  });

  it('expõe status do verificador de preços para o Dashboard sem consultar links externos', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/ofertas/verificacao-precos/status')
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(typeof res.body.elegiveis).toBe('number');
    expect(typeof res.body.nuncaVerificadas).toBe('number');
    expect(typeof res.body.desatualizadasMaisDe24h).toBe('number');
  });

  it('preserva histórico, usa soft delete e mantém a oferta se o Hardware for removido', async () => {
    const urlOriginal = `https://example.com/produto-${sufixo}`;
    const criado = await request(app.getHttpServer())
      .post('/api/admin/ofertas')
      .set('Cookie', cookieAdmin)
      .send({
        hardwareId,
        parceiroId: parceiroBaseId,
        vendedorNome: 'Loja oficial',
        urlOriginal,
        urlAfiliada: `https://affiliate.example.com/${sufixo}`,
        preco: 1000,
        precoAnterior: 1200,
        frete: 25.5,
        validoAte: new Date(Date.now() + 86_400_000).toISOString(),
      });

    expect(criado.status).toBe(201);
    const ofertaId = criado.body.id as number;

    const historicoInicial = await request(app.getHttpServer())
      .get(`/api/admin/ofertas/${ofertaId}/historico`)
      .set('Cookie', cookieAdmin);
    expect(historicoInicial.status).toBe(200);
    expect(historicoInicial.body.total).toBe(1);

    const precoAlterado = await request(app.getHttpServer())
      .patch(`/api/admin/ofertas/${ofertaId}`)
      .set('Cookie', cookieAdmin)
      .send({ preco: 900 });

    expect(precoAlterado.status).toBe(200);
    expect(Number(precoAlterado.body.preco)).toBe(900);
    expect(Number(precoAlterado.body.precoAnterior)).toBe(1000);

    const historicoAlterado = await request(app.getHttpServer())
      .get(`/api/admin/ofertas/${ofertaId}/historico`)
      .set('Cookie', cookieAdmin);
    expect(historicoAlterado.body.total).toBe(2);

    const mesmoPreco = await request(app.getHttpServer())
      .patch(`/api/admin/ofertas/${ofertaId}`)
      .set('Cookie', cookieAdmin)
      .send({ preco: 900 });
    expect(mesmoPreco.status).toBe(200);

    const historicoSemDuplicar = await request(app.getHttpServer())
      .get(`/api/admin/ofertas/${ofertaId}/historico`)
      .set('Cookie', cookieAdmin);
    expect(historicoSemDuplicar.body.total).toBe(2);

    const opcionaisLimpos = await request(app.getHttpServer())
      .patch(`/api/admin/ofertas/${ofertaId}`)
      .set('Cookie', cookieAdmin)
      .send({
        urlAfiliada: null,
        frete: null,
        validoAte: null,
        precoAnterior: null,
        vendedorNome: null,
        vendedorIdentificador: null,
      });

    expect(opcionaisLimpos.status).toBe(200);
    expect(opcionaisLimpos.body.urlAfiliada).toBeNull();
    expect(opcionaisLimpos.body.frete).toBeNull();
    expect(opcionaisLimpos.body.validoAte).toBeNull();
    expect(opcionaisLimpos.body.precoAnterior).toBeNull();

    const publicoAntes = await request(app.getHttpServer()).get(
      `/api/ofertas/produto/${produtoId}`,
    );
    expect(publicoAntes.status).toBe(200);
    expect(publicoAntes.body.quantidadeOfertasAtivas).toBe(1);
    expect(publicoAntes.body.melhorOferta.urlCompra).toBe(urlOriginal);

    const removida = await request(app.getHttpServer())
      .delete(`/api/admin/ofertas/${ofertaId}`)
      .set('Cookie', cookieAdmin);

    expect(removida.status).toBe(200);
    expect(removida.body.status).toBe(StatusOferta.DESCONTINUADA);

    const ofertaPreservada = await prisma.oferta.findUnique({
      where: { id: ofertaId },
      select: { id: true, status: true, hardwareId: true },
    });
    expect(ofertaPreservada).not.toBeNull();
    expect(ofertaPreservada?.status).toBe(StatusOferta.DESCONTINUADA);

    const historicoPreservado = await prisma.historicoPrecoOferta.count({
      where: { ofertaId },
    });
    expect(historicoPreservado).toBe(3);

    const publicoDepois = await request(app.getHttpServer()).get(
      `/api/ofertas/produto/${produtoId}`,
    );
    expect(publicoDepois.status).toBe(200);
    expect(publicoDepois.body.quantidadeOfertasAtivas).toBe(0);
    expect(publicoDepois.body.melhorOferta).toBeNull();

    const historicoPublicoRemovido = await request(app.getHttpServer()).get(
      `/api/ofertas/${ofertaId}/historico`,
    );
    expect(historicoPublicoRemovido.status).toBe(404);

    const historicoAdmin = await request(app.getHttpServer())
      .get(`/api/admin/ofertas/${ofertaId}/historico`)
      .set('Cookie', cookieAdmin);
    expect(historicoAdmin.status).toBe(200);
    expect(historicoAdmin.body.total).toBe(3);

    await prisma.hardware.delete({ where: { id: hardwareId } });

    const aposExcluirHardware = await prisma.oferta.findUnique({
      where: { id: ofertaId },
      select: { id: true, hardwareId: true, produtoId: true, status: true },
    });
    expect(aposExcluirHardware).not.toBeNull();
    expect(aposExcluirHardware?.hardwareId).toBeNull();
    expect(aposExcluirHardware?.produtoId).toBe(produtoId);

    const reativada = await request(app.getHttpServer())
      .patch(`/api/admin/ofertas/${ofertaId}`)
      .set('Cookie', cookieAdmin)
      .send({ status: StatusOferta.ATIVA });
    expect(reativada.status).toBe(200);

    const publicoSemHardware = await request(app.getHttpServer()).get(
      `/api/ofertas/produto/${produtoId}`,
    );
    expect(publicoSemHardware.status).toBe(200);
    expect(publicoSemHardware.body.quantidadeOfertasAtivas).toBe(1);
    expect(publicoSemHardware.body.melhorOferta.precoAtual).toBe(900);
  });
});
