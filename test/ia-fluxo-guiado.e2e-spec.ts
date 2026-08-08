import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';

describe('IA — fluxo guiado e peças fora do catálogo (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let cookieAdmin: string;
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tituloBuild = `Build externa IA E2E ${sufixo}`;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.buildComunidade.deleteMany({
        where: { titulo: tituloBuild },
      });
    }
    if (app) await app.close();
  });

  it('chat reconhece pedido de montar PC e devolve fluxo clicável sem depender do Gemini', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .send({ mensagem: 'Quero montar um PC gamer' });

    expect(res.status).toBe(200);
    expect(res.body.fluxoGuiado).toMatchObject({
      tipo: 'MONTAGEM_GUIADA',
      etapa: 'PROCESSADOR',
    });
    expect(Array.isArray(res.body.fluxoGuiado.acoes)).toBe(true);
  });

  it('aceita peça externa, mantém compra indisponível e avança de etapa', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/montagem-guiada')
      .send({
        acao: 'SELECIONAR',
        etapaAtual: 'PROCESSADOR',
        componentes: [],
        selecao: {
          categoria: 'PROCESSADOR',
          nome: 'CPU Externa E2E',
          marca: 'Teste',
          modelo: 'CPU-X',
          origem: 'EXTERNO',
          fonteDadosUrl: 'https://fabricante.example/cpu-x',
          especificacoes: {
            socket: 'AM5',
            tdpWatts: 65,
            possuiVideoIntegrado: true,
            tiposMemoriaSuportados: ['DDR5'],
          },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.etapa).toBe('PLACA_MAE');
    expect(res.body.componentes[0]).toMatchObject({
      hardwareId: null,
      nome: 'CPU Externa E2E',
      origem: 'EXTERNO',
      compravel: false,
    });
    expect(res.body.compra.itens[0].compravel).toBe(false);
  });

  it('não chama peça externa incompatível de compatível', async () => {
    const cpu = {
      categoria: 'PROCESSADOR',
      nome: 'CPU Externa AM5',
      origem: 'EXTERNO',
      quantidade: 1,
      especificacoes: {
        socket: 'AM5',
        possuiVideoIntegrado: true,
      },
    };

    const res = await request(app.getHttpServer())
      .post('/api/ia/montagem-guiada')
      .send({
        acao: 'SELECIONAR',
        etapaAtual: 'PLACA_MAE',
        componentes: [cpu],
        selecao: {
          categoria: 'PLACA_MAE',
          nome: 'Placa-mãe Externa LGA1700',
          origem: 'EXTERNO',
          especificacoes: {
            socket: 'LGA1700',
            formato: 'ATX',
            tiposMemoriaSuportados: ['DDR5'],
            formatosMemoriaSuportados: ['DIMM'],
            slotsMemoria: 4,
          },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.compatibilidade.status).toBe('INCOMPATIVEL');
    expect(res.body.compatibilidade.erros.join(' ')).toContain('AM5');
    expect(res.body.compatibilidade.erros.join(' ')).toContain('LGA1700');
  });

  it('importação ADMIN por link bloqueia localhost/rede privada antes de acessar a URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/ia/importar-link')
      .set('Cookie', cookieAdmin)
      .send({ url: 'http://127.0.0.1:3000/produto' });

    expect(res.status).toBe(400);
  });

  it('Build da Comunidade preserva snapshot técnico externo e bloqueia incompatibilidade conhecida ao publicar', async () => {
    const componentes = [
      {
        categoria: 'PROCESSADOR',
        nome: 'CPU Externa AM5',
        origem: 'EXTERNO',
        fonteDadosUrl: 'https://fabricante.example/cpu',
        especificacoes: {
          socket: 'AM5',
          possuiVideoIntegrado: true,
          tdpWatts: 65,
        },
      },
      {
        categoria: 'PLACA_MAE',
        nome: 'Placa-mãe Externa LGA1700',
        origem: 'EXTERNO',
        especificacoes: {
          socket: 'LGA1700',
          formato: 'ATX',
          tiposMemoriaSuportados: ['DDR5'],
          formatosMemoriaSuportados: ['DIMM'],
          slotsMemoria: 4,
        },
      },
      {
        categoria: 'MEMORIA_RAM',
        nome: 'RAM Externa DDR5',
        origem: 'EXTERNO',
        especificacoes: {
          tipo: 'DDR5',
          formato: 'DIMM',
          capacidadePorModuloGb: 16,
          quantidadeModulos: 2,
        },
      },
      {
        categoria: 'ARMAZENAMENTO',
        nome: 'SSD Externo',
        origem: 'EXTERNO',
        especificacoes: {
          tipo: 'SSD',
          formato: 'M2',
          interface: 'NVME',
          capacidadeGb: 1000,
        },
      },
      {
        categoria: 'FONTE',
        nome: 'Fonte Externa 750W',
        origem: 'EXTERNO',
        especificacoes: { formato: 'ATX', potenciaWatts: 750 },
      },
      {
        categoria: 'GABINETE',
        nome: 'Gabinete Externo ATX',
        origem: 'EXTERNO',
        especificacoes: {
          formatosPlacaMaeSuportados: ['ATX', 'MICRO_ATX'],
          formatosFonteSuportados: ['ATX'],
          comprimentoMaximoGpuMm: 350,
        },
      },
    ];

    const criada = await request(app.getHttpServer())
      .post('/api/comunidade/builds')
      .set('Cookie', cookieAdmin)
      .send({ titulo: tituloBuild, componentes });

    expect(criada.status).toBe(201);
    const cpuSalva = criada.body.componentes.find(
      (item: { categoria: string }) => item.categoria === 'PROCESSADOR',
    );
    expect(cpuSalva).toMatchObject({
      hardwareId: null,
      origem: 'EXTERNO',
      fonteDadosUrl: 'https://fabricante.example/cpu',
    });
    expect(cpuSalva.especificacoes).toMatchObject({ socket: 'AM5' });

    const publicar = await request(app.getHttpServer())
      .patch(`/api/comunidade/builds/${criada.body.id}`)
      .set('Cookie', cookieAdmin)
      .send({ status: 'PUBLICADA' });

    expect(publicar.status).toBe(400);
    expect(JSON.stringify(publicar.body)).toContain(
      'BUILD_COMUNIDADE_INCOMPATIVEL',
    );
  });
});
