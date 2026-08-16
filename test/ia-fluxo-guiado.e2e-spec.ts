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

<<<<<<< HEAD
  it('chat reconhece pedido de montar PC e oferece botões locais antes de usar Gemini', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .send({ mensagem: 'Quero montar um PC' });

    expect(res.status).toBe(200);
    expect(res.body.processamento).toMatchObject({
      modo: 'LOCAL',
      geminiUtilizado: false,
    });
    expect(res.body.interfaceSugerida.modo).toBe('BOTOES');
    expect(res.body.interfaceSugerida.manterCampoTextoLivre).toBe(false);
    expect(res.body.interfaceSugerida.botoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rotulo: 'Jogos', usaGemini: false }),
      ]),
    );
  });

  it('reconhece preset "Monta PC até R$ 4.000" e preserva orçamento nos botões locais', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .send({ mensagem: 'Monta PC até R$ 4.000' });

    expect(res.status).toBe(200);
    expect(res.body.processamento.geminiUtilizado).toBe(false);
    expect(res.body.interfaceSugerida.botoes[0].acao.body.orcamento).toBe(4000);
  });

  it('continua conversa de montagem quando usuário responde "jogos" sem depender do Gemini', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .send({
        mensagem: 'jogos',
        historico: [
          {
            papel: 'usuario',
            conteudo: 'Monta PC até R$ 4.000',
          },
          {
            papel: 'assistente',
            conteudo: 'Qual será o foco principal do PC?',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.resposta).toContain('jogos');
=======
  it('chat reconhece pedido de montar PC e devolve fluxo clicável sem depender do Gemini', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .send({ mensagem: 'Quero montar um PC gamer' });

    expect(res.status).toBe(200);
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
    expect(res.body.fluxoGuiado).toMatchObject({
      tipo: 'MONTAGEM_GUIADA',
      etapa: 'PROCESSADOR',
    });
<<<<<<< HEAD
=======
    expect(Array.isArray(res.body.fluxoGuiado.acoes)).toBe(true);
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
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

<<<<<<< HEAD
  it('menu público da IA é orientado a botões e não usa Gemini', async () => {
    const res = await request(app.getHttpServer()).get('/api/ia/menu');

    expect(res.status).toBe(200);
    expect(res.body.processamento.geminiUtilizado).toBe(false);
    expect(res.body.interfaceSugerida.modo).toBe('BOTOES');
    expect(res.body.interfaceSugerida.botoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'MONTAR_PC', usaGemini: false }),
        expect.objectContaining({ id: 'PERGUNTAR_IA', usaGemini: true }),
      ]),
    );
  });

  it('mensagem livre não consome Gemini sem autorização explícita do frontend', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .send({ mensagem: 'Qual placa de vídeo você recomenda?' });

    expect(res.status).toBe(200);
    expect(res.body.processamento).toMatchObject({
      modo: 'LOCAL',
      geminiUtilizado: false,
    });
    expect(res.body.interfaceSugerida.modo).toBe('BOTOES');
  });

  it('menu ADMIN da IA oferece ações locais para cadastro e Busca de Ofertas', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/ia/menu')
      .set('Cookie', cookieAdmin);

    expect(res.status).toBe(200);
    expect(res.body.processamento.geminiUtilizado).toBe(false);
    expect(res.body.interfaceSugerida.botoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'CADASTRAR_HARDWARE' }),
        expect.objectContaining({ id: 'CADASTRAR_PRODUTO' }),
        expect.objectContaining({ id: 'CADASTRAR_OFERTA' }),
        expect.objectContaining({ id: 'BUSCA_OFERTAS' }),
      ]),
    );
  });

  it('chat ADMIN reconhece comando de cadastro por URL localmente e não usa Gemini para entender a intenção', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/ia/chat')
      .set('Cookie', cookieAdmin)
      .send({
        mensagem:
          'Cadastre essa fonte: https://www.gigabyte.com/br/Power-Supply/P850GM/sp',
      });

    expect(res.status).toBe(200);
    expect(res.body.processamento).toMatchObject({
      modo: 'LOCAL',
      geminiUtilizado: false,
    });
    expect(res.body.acaoEstruturada).toMatchObject({
      tipo: 'IMPORTAR_E_ABRIR_CADASTRO',
      executarAutomaticamente: true,
      salvarAutomaticamente: false,
      requerPapel: 'ADMIN',
      requisicao: {
        metodo: 'POST',
        rota: '/api/admin/ia/importar-link',
        body: {
          url: 'https://www.gigabyte.com/br/Power-Supply/P850GM/sp',
          categoriaEsperada: 'FONTE',
        },
      },
    });
  });

  it('chat ADMIN pode abrir cadastro de Hardware sem Gemini e sem salvar automaticamente', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/ia/chat')
      .set('Cookie', cookieAdmin)
      .send({ mensagem: 'Abra o cadastro de uma fonte' });

    expect(res.status).toBe(200);
    expect(res.body.processamento.geminiUtilizado).toBe(false);
    expect(res.body.acaoEstruturada).toMatchObject({
      tipo: 'ABRIR_CADASTRO_HARDWARE',
      abrirAutomaticamente: true,
      salvarAutomaticamente: false,
      dadosIniciais: {
        categoria: 'FONTE',
        publicado: false,
        ativo: true,
      },
    });
  });

=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
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
