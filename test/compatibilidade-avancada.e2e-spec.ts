import request from 'supertest';
import {
  CategoriaHardware,
  FormatoArmazenamento,
  FormatoFonte,
  FormatoMemoria,
  InterfaceArmazenamento,
  PosicaoRefrigeracaoGabinete,
  TipoArmazenamento,
  TipoCooler,
  TipoMemoria,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { App, criarApp, loginAdmin } from './app-setup';
import {
  criarFixturePcCompleto,
  FixturePcCompleto,
  limparFixturePcCompleto,
} from './fixtures/pc-completo.fixture';

describe('Compatibilidade avançada de hardware (e2e)', () => {
  let app: App;
  let prisma: PrismaService;
  let fixture: FixturePcCompleto;
  let cookieAdmin: string;
  const temporarios: number[] = [];

  const baseMontagem = () => ({
    placaMaeId: fixture.hardwares.placaMaeId,
    processadorId: fixture.hardwares.processadorId,
    memoriaRamId: fixture.hardwares.memoriaRamId,
    quantidadeModulosRam: 2,
    quantidadeModulosRamTotal: 2,
    gabineteId: fixture.hardwares.gabineteId,
    fonteId: fixture.hardwares.fonteId,
    placaVideoId: fixture.hardwares.placaVideoId,
    coolerId: fixture.hardwares.coolerId,
    armazenamentoIds: [fixture.hardwares.armazenamentoId],
    ventoinhas: [
      {
        ventoinhaId: fixture.hardwares.ventoinhaId,
        posicao: PosicaoRefrigeracaoGabinete.FRENTE,
        quantidade: 3,
      },
    ],
  });

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    cookieAdmin = await loginAdmin(app);
    fixture = await criarFixturePcCompleto(prisma);
  });

  afterAll(async () => {
    if (prisma) {
      if (temporarios.length > 0) {
        await prisma.hardware.deleteMany({
          where: { id: { in: temporarios } },
        });
      }
      if (fixture) await limparFixturePcCompleto(prisma, fixture);
    }
    if (app) await app.close();
  });

  it('compatibilidade não confirmada vira alerta e não incompatibilidade', async () => {
    const sufixo = `${Date.now()}-cpu-nao-confirmada`;
    const cpu = await prisma.hardware.create({
      data: {
        nome: `CPU sem lista E2E ${sufixo}`,
        slug: `cpu-sem-lista-e2e-${sufixo}`,
        categoria: CategoriaHardware.PROCESSADOR,
        marca: 'CriaByte Testes',
        modelo: `CPU-UNKNOWN-${sufixo}`,
        publicado: true,
        ativo: true,
        especificacaoProcessador: {
          create: {
            socket: 'AM5',
            tdpWatts: 65,
            possuiVideoIntegrado: true,
            tiposMemoriaSuportados: [TipoMemoria.DDR5],
            frequenciaMemoriaMaximaMhz: 5600,
            capacidadeMemoriaMaximaGb: 128,
          },
        },
      },
    });
    temporarios.push(cpu.id);

    const res = await request(app.getHttpServer())
      .post('/api/hardwares/compatibilidades/montagem')
      .send({ ...baseMontagem(), processadorId: cpu.id });

    expect(res.status).toBe(200);
    expect(res.body.compativel).toBe(true);
    expect(res.body.confirmado).toBe(false);
    expect(res.body.status).toBe('COMPATIVEL_COM_ALERTAS');
    expect(res.body.resumo.totalNaoConfirmados).toBeGreaterThan(0);
  });

  it('sem GPU dedicada exige vídeo integrado funcional', async () => {
    const sufixo = `${Date.now()}-cpu-sem-video`;
    const cpu = await prisma.hardware.create({
      data: {
        nome: `CPU sem vídeo E2E ${sufixo}`,
        slug: `cpu-sem-video-e2e-${sufixo}`,
        categoria: CategoriaHardware.PROCESSADOR,
        marca: 'CriaByte Testes',
        modelo: `CPU-NOVIDEO-${sufixo}`,
        publicado: true,
        ativo: true,
        especificacaoProcessador: {
          create: {
            socket: 'AM5',
            tdpWatts: 65,
            possuiVideoIntegrado: false,
            tiposMemoriaSuportados: [TipoMemoria.DDR5],
            frequenciaMemoriaMaximaMhz: 5600,
            capacidadeMemoriaMaximaGb: 128,
          },
        },
      },
    });
    temporarios.push(cpu.id);

    const dados = baseMontagem();
    delete (dados as { placaVideoId?: number }).placaVideoId;

    const res = await request(app.getHttpServer())
      .post('/api/hardwares/compatibilidades/montagem')
      .send({ ...dados, processadorId: cpu.id });

    expect(res.status).toBe(200);
    expect(res.body.compativel).toBe(false);
    expect(res.body.erros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ etapa: 'SAIDA_VIDEO' }),
      ]),
    );
  });

  it('SO-DIMM não é aceito por placa-mãe configurada apenas para DIMM', async () => {
    const sufixo = `${Date.now()}-sodimm`;
    const memoria = await prisma.hardware.create({
      data: {
        nome: `SO-DIMM E2E ${sufixo}`,
        slug: `sodimm-e2e-${sufixo}`,
        categoria: CategoriaHardware.MEMORIA_RAM,
        marca: 'CriaByte Testes',
        modelo: `SODIMM-${sufixo}`,
        publicado: true,
        ativo: true,
        especificacaoMemoriaRam: {
          create: {
            tipo: TipoMemoria.DDR5,
            formato: FormatoMemoria.SO_DIMM,
            capacidadePorModuloGb: 16,
            quantidadeModulos: 1,
            frequenciaMhz: 5600,
          },
        },
      },
    });
    temporarios.push(memoria.id);

    const res = await request(app.getHttpServer()).get(
      `/api/hardwares/compatibilidades/memoria-placa-mae/${fixture.hardwares.placaMaeId}/${memoria.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.compativel).toBe(false);
    expect(res.body.motivo).toMatch(/formato físico/i);
  });

  it('ECC e memória registrada respeitam suporte explícito da placa-mãe', async () => {
    const sufixo = `${Date.now()}-rdimm`;
    const memoria = await prisma.hardware.create({
      data: {
        nome: `RDIMM ECC E2E ${sufixo}`,
        slug: `rdimm-ecc-e2e-${sufixo}`,
        categoria: CategoriaHardware.MEMORIA_RAM,
        marca: 'CriaByte Testes',
        modelo: `RDIMM-${sufixo}`,
        publicado: true,
        ativo: true,
        especificacaoMemoriaRam: {
          create: {
            tipo: TipoMemoria.DDR5,
            formato: FormatoMemoria.DIMM,
            capacidadePorModuloGb: 16,
            quantidadeModulos: 1,
            frequenciaMhz: 4800,
            ecc: true,
            registrada: true,
          },
        },
      },
    });
    temporarios.push(memoria.id);

    const res = await request(app.getHttpServer()).get(
      `/api/hardwares/compatibilidades/memoria-placa-mae/${fixture.hardwares.placaMaeId}/${memoria.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.compativel).toBe(false);
    expect(res.body.motivo).toMatch(/ECC|registrada/i);
  });

  it('soma todas as ventoinhas da mesma posição antes de validar o limite', async () => {
    const dados = baseMontagem();
    dados.ventoinhas = [
      {
        ventoinhaId: fixture.hardwares.ventoinhaId,
        posicao: PosicaoRefrigeracaoGabinete.FRENTE,
        quantidade: 2,
      },
      {
        ventoinhaId: fixture.hardwares.ventoinhaId,
        posicao: PosicaoRefrigeracaoGabinete.FRENTE,
        quantidade: 2,
      },
    ];

    const res = await request(app.getHttpServer())
      .post('/api/hardwares/compatibilidades/montagem')
      .send(dados);

    expect(res.status).toBe(200);
    expect(res.body.compativel).toBe(false);
    expect(res.body.erros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ etapa: 'OCUPACAO_VENTOINHAS_GABINETE' }),
      ]),
    );
  });

  it('valida quantidade total de baias do gabinete', async () => {
    const sufixo = `${Date.now()}-ssd-sata`;
    const armazenamento = await prisma.hardware.create({
      data: {
        nome: `SSD SATA E2E ${sufixo}`,
        slug: `ssd-sata-e2e-${sufixo}`,
        categoria: CategoriaHardware.ARMAZENAMENTO,
        marca: 'CriaByte Testes',
        modelo: `SSD-SATA-${sufixo}`,
        publicado: true,
        ativo: true,
        especificacaoArmazenamento: {
          create: {
            tipo: TipoArmazenamento.SSD,
            formato: FormatoArmazenamento.POLEGADAS_2_5,
            interface: InterfaceArmazenamento.SATA,
            capacidadeGb: 1000,
            consumoWatts: 4,
          },
        },
      },
    });
    temporarios.push(armazenamento.id);

    const res = await request(app.getHttpServer())
      .post('/api/hardwares/compatibilidades/montagem')
      .send({
        ...baseMontagem(),
        armazenamentoIds: [
          armazenamento.id,
          armazenamento.id,
          armazenamento.id,
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.compativel).toBe(false);
    expect(res.body.erros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ etapa: 'MULTIPLICIDADE_SLOTS' }),
      ]),
    );
  });

  it('fonte precisa possuir conectores principais da placa-mãe/CPU', async () => {
    const sufixo = `${Date.now()}-fonte-sem-eps`;
    const fonte = await prisma.hardware.create({
      data: {
        nome: `Fonte sem EPS E2E ${sufixo}`,
        slug: `fonte-sem-eps-e2e-${sufixo}`,
        categoria: CategoriaHardware.FONTE,
        marca: 'CriaByte Testes',
        modelo: `PSU-NOEPS-${sufixo}`,
        publicado: true,
        ativo: true,
        especificacaoFonte: {
          create: {
            formato: FormatoFonte.ATX,
            potenciaWatts: 750,
            comprimentoMm: 150,
            conectoresAtx24Pinos: 1,
            conectoresEpsCpu: 0,
            conectoresPcie8Pinos: 3,
            conectoresSata: 6,
          },
        },
      },
    });
    temporarios.push(fonte.id);

    const res = await request(app.getHttpServer())
      .post('/api/hardwares/compatibilidades/montagem')
      .send({ ...baseMontagem(), fonteId: fonte.id });

    expect(res.status).toBe(200);
    expect(res.body.compativel).toBe(false);
    expect(res.body.erros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ etapa: 'ALIMENTACAO_PRINCIPAL_FONTE' }),
      ]),
    );
  });

  it('air cooler valida a altura da memória RAM quando os dados existem', async () => {
    const sufixo = `${Date.now()}-clearance`;
    const memoria = await prisma.hardware.create({
      data: {
        nome: `RAM alta E2E ${sufixo}`,
        slug: `ram-alta-e2e-${sufixo}`,
        categoria: CategoriaHardware.MEMORIA_RAM,
        marca: 'CriaByte Testes',
        modelo: `RAM-HIGH-${sufixo}`,
        publicado: true,
        ativo: true,
        especificacaoMemoriaRam: {
          create: {
            tipo: TipoMemoria.DDR5,
            formato: FormatoMemoria.DIMM,
            capacidadePorModuloGb: 8,
            quantidadeModulos: 1,
            frequenciaMhz: 5600,
            alturaMm: 50,
          },
        },
      },
    });
    temporarios.push(memoria.id);

    const cooler = await prisma.hardware.create({
      data: {
        nome: `Cooler baixo E2E ${sufixo}`,
        slug: `cooler-baixo-e2e-${sufixo}`,
        categoria: CategoriaHardware.COOLER,
        marca: 'CriaByte Testes',
        modelo: `COOLER-LOW-${sufixo}`,
        publicado: true,
        ativo: true,
        especificacaoCooler: {
          create: {
            tipo: TipoCooler.AIR_COOLER,
            socketsSuportados: ['AM5'],
            capacidadeTermicaWatts: 180,
            alturaMm: 150,
            alturaLivreRamMm: 35,
          },
        },
      },
    });
    temporarios.push(cooler.id);

    const res = await request(app.getHttpServer())
      .post('/api/hardwares/compatibilidades/montagem')
      .send({
        ...baseMontagem(),
        memoriaRamId: memoria.id,
        quantidadeModulosRam: 1,
        quantidadeModulosRamTotal: 1,
        coolerId: cooler.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.compativel).toBe(false);
    expect(res.body.erros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ etapa: 'COOLER_PROCESSADOR_GABINETE' }),
      ]),
    );
  });

  it('cadastro rejeita M.2 sem tamanho/chave antes de chegar ao banco', async () => {
    const sufixo = `${Date.now()}-m2-invalido`;
    const res = await request(app.getHttpServer())
      .post('/api/hardwares')
      .set('Cookie', cookieAdmin)
      .send({
        nome: `SSD inválido E2E ${sufixo}`,
        categoria: CategoriaHardware.ARMAZENAMENTO,
        marca: 'CriaByte Testes',
        modelo: `SSD-BAD-${sufixo}`,
        especificacaoArmazenamento: {
          tipo: TipoArmazenamento.SSD,
          formato: FormatoArmazenamento.M2,
          interface: InterfaceArmazenamento.NVME_PCIE,
          capacidadeGb: 1000,
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/M\.2.*tamanho.*chave/i);
  });
});
