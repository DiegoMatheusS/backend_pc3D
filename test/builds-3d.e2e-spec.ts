import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';
import {
  componentesBuildFixture,
  criarFixturePcCompleto,
  FixturePcCompleto,
  limparFixturePcCompleto,
} from './fixtures/pc-completo.fixture';

describe('Build comercial → montagem 3D automática (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  let fixture: FixturePcCompleto;
  let buildId = 0;
  let produtoBuildId = 0;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);
    fixture = await criarFixturePcCompleto(prisma);

    const criarBuild = await request(app.getHttpServer())
      .post('/api/admin/builds')
      .set('Cookie', cookieAdmin)
      .send({
        nome: `Build 3D E2E ${Date.now()}`,
        publicado: true,
        componentes: componentesBuildFixture(fixture),
      });

    if (criarBuild.status !== 201) {
      throw new Error(
        `Falha ao criar build 3D da fixture: ${criarBuild.status} ${JSON.stringify(criarBuild.body)}`,
      );
    }

    buildId = (criarBuild.body as { id: number }).id;
    produtoBuildId = (criarBuild.body as { produtoId: number }).produtoId;
  });

  afterAll(async () => {
    if (prisma && produtoBuildId) {
      await prisma.produto.deleteMany({ where: { id: produtoBuildId } });
    }
    if (prisma && fixture) {
      await limparFixturePcCompleto(prisma, fixture);
    }
    if (app) await app.close();
  });

  it('GET /api/builds/:id/3d → montagem completa e renderizável', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/builds/${buildId}/3d`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('buildId', buildId);

    const montagem3D = res.body.montagemCompleta?.montagem3D;
    expect(montagem3D).toBeDefined();
    expect(montagem3D.total).toBe(11);
    expect(montagem3D.montagemRenderizavel).toBe(true);
    expect(montagem3D.hardwarePaiSemModelo3D).toBe(true);
    expect(montagem3D.hardwarePaiRequerDesenho).toBe(true);
    expect(montagem3D.hardwarePaiRenderizadoPorDesenho).toBe(true);
    expect(montagem3D.hardwarePaiSemDadosDesenho).toBe(false);
    expect(montagem3D.hardwarePai).toMatchObject({
      modoRenderizacao: 'DESENHO',
      modelo3D: null,
    });
    expect(montagem3D.hardwarePai.desenho).toMatchObject({
      tipo: 'GABINETE_2_5D',
      referenciaVisual: {
        hardwareId: fixture.hardwares.gabineteId,
        fidelidadeEsperada: 'FORMA_ESPECIFICA_DO_MODELO',
      },
      estrategiaVisual: {
        cascaGabinete: 'DESENHO_JAVASCRIPT_2_5D',
        perfilForma: 'POR_MODELO_DE_GABINETE',
        componentesInternos: 'MODELOS_3D',
        objetivo: 'REPRODUZIR_FORMA_DO_GABINETE_REAL',
        estadosEnergia: {
          desligado: {
            modo: 'ESTATICO',
            animarVentoinhas: false,
            efeitosVisuaisAprimorados: false,
          },
          ligado: {
            modo: 'APRIMORADO',
            animarVentoinhas: true,
            aplicarIluminacaoConformeHardware: true,
            realcarComponentesAtivos: true,
            efeitosVisuaisAprimorados: true,
          },
        },
      },
    });
    expect(montagem3D.hardwarePai.desenho.convencaoDimensoes).toBe(
      'ALTURA_LARGURA_PROFUNDIDADE',
    );
    expect(typeof montagem3D.hardwarePai.desenho.dimensoesMm.altura).toBe(
      'number',
    );
    expect(typeof montagem3D.hardwarePai.desenho.dimensoesMm.largura).toBe(
      'number',
    );
    expect(typeof montagem3D.hardwarePai.desenho.dimensoesMm.profundidade).toBe(
      'number',
    );
    expect(montagem3D.itensSemModelo3D).toEqual([]);
    expect(montagem3D.calibracaoVisual).toBeDefined();
    expect(['BASE', 'REFINADA']).toContain(montagem3D.calibracaoVisual.status);
    expect(typeof montagem3D.calibracaoVisual.refinada).toBe('boolean');
    expect(
      Array.isArray(montagem3D.calibracaoVisual.itensSemAjusteEspecifico),
    ).toBe(true);

    const itens = montagem3D.itens as Array<{
      instanciaId: string;
      instanciaPaiId: string;
      hardwareFilho: { modelo3D: { id: number } | null };
    }>;

    const porInstancia = new Map(itens.map((item) => [item.instanciaId, item]));

    expect(porInstancia.get('fonte-1')?.instanciaPaiId).toBe(
      `hardware-raiz-${fixture.hardwares.gabineteId}`,
    );
    expect(porInstancia.get('fonte-1')?.hardwareFilho.modelo3D?.id).toBe(
      fixture.modelos3D.fonteId,
    );
    expect(porInstancia.get('cooler-1')?.instanciaPaiId).toBe('placa-mae-1');
    expect(porInstancia.get('cooler-1')?.hardwareFilho.modelo3D?.id).toBe(
      fixture.modelos3D.coolerId,
    );
    expect(porInstancia.has('ram-1')).toBe(true);
    expect(porInstancia.has('ram-2')).toBe(true);

    expect(res.body.montagemCompleta.resumoFisico).toMatchObject({
      placasMae: 1,
      processadores: 1,
      placasVideo: 1,
      fontes: 1,
      coolers: 1,
      modulosRam: 2,
      capacidadeMemoriaTotalGb: 16,
      armazenamentos: 1,
      ventoinhas: 3,
    });

    expect(res.body.resumoCompra).toBeDefined();
    expect(res.body.resumoCompra.componentes.totalLinhas).toBe(9);

    expect(res.body.montagemCompleta.compatibilidade).toMatchObject({
      compativel: true,
      resumo: { totalErros: 0 },
    });
  });
});
