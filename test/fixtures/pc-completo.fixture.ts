import {
  CategoriaHardware,
  ChaveM2,
  FormatoArmazenamento,
  FormatoFonte,
  FormatoMemoria,
  FormatoModelo3D,
  FormatoPlacaMae,
  InterfaceArmazenamento,
  PosicaoRefrigeracaoGabinete,
  TamanhoGabinete,
  TipoArmazenamento,
  TipoConectorVentoinha,
  TipoCooler,
  TipoMemoria,
} from '../../src/generated/prisma/enums';
import { PrismaService } from '../../src/prisma/prisma.service';

export type FixturePcCompleto = {
  hardwares: {
    gabineteId: number;
    placaMaeId: number;
    processadorId: number;
    memoriaRamId: number;
    placaVideoId: number;
    armazenamentoId: number;
    fonteId: number;
    coolerId: number;
    ventoinhaId: number;
  };
  pontos: {
    placaMae: number;
    fonte: number;
    gpu: number;
    fan1: number;
    fan2: number;
    fan3: number;
    cpu: number;
    ram1: number;
    ram2: number;
    cooler: number;
    m2: number;
  };
  modelos3D: {
    placaMaeId: number;
    processadorId: number;
    memoriaRamId: number;
    placaVideoId: number;
    armazenamentoId: number;
    fonteId: number;
    coolerId: number;
    ventoinhaId: number;
  };
  todosHardwareIds: number[];
};

function sufixoUnico(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function criarFixturePcCompleto(
  prisma: PrismaService,
): Promise<FixturePcCompleto> {
  const sufixo = sufixoUnico();

  const gabinete = await prisma.hardware.create({
    data: {
      nome: `Gabinete E2E ${sufixo}`,
      slug: `gabinete-e2e-${sufixo}`,
      categoria: CategoriaHardware.GABINETE,
      marca: 'CriaByte Testes',
      modelo: `CASE-${sufixo}`,
      publicado: true,
      ativo: true,
      especificacaoGabinete: {
        create: {
          tamanho: TamanhoGabinete.MID_TOWER,
          alturaMm: 450,
          larguraMm: 220,
          profundidadeMm: 450,
          formatosPlacaMaeSuportados: [FormatoPlacaMae.ATX],
          formatosFonteSuportados: [FormatoFonte.ATX],
          comprimentoMaximoFonteMm: 220,
          comprimentoMaximoGpuMm: 360,
          alturaMaximaGpuMm: 160,
          slotsMaximosGpu: 4,
          alturaMaximaCoolerCpuMm: 170,
          baias25: 2,
          baias35: 2,
          slotsTraseiros: 7,
          suportaGpuVertical: false,
          espacoGerenciamentoCabosMm: 25,
          suportesFans: {
            create: {
              posicao: PosicaoRefrigeracaoGabinete.FRENTE,
              tamanhoMm: 120,
              quantidadeMaxima: 3,
              espessuraMaximaMm: 30,
            },
          },
        },
      },
    },
  });

  const placaMae = await prisma.hardware.create({
    data: {
      nome: `Placa-mãe E2E ${sufixo}`,
      slug: `placa-mae-e2e-${sufixo}`,
      categoria: CategoriaHardware.PLACA_MAE,
      marca: 'CriaByte Testes',
      modelo: `MB-${sufixo}`,
      publicado: true,
      ativo: true,
      especificacaoPlacaMae: {
        create: {
          socket: 'AM5',
          chipset: 'B650-E2E',
          formato: FormatoPlacaMae.ATX,
          tiposMemoriaSuportados: [TipoMemoria.DDR5],
          frequenciasMemoriaJedecMhz: [4800, 5600],
          frequenciasMemoriaOverclockMhz: [6000],
          slotsMemoria: 4,
          capacidadeMaximaMemoriaGb: 128,
          capacidadeMaximaPorSlotGb: 32,
          saidasVideo: ['HDMI'],
          portasSata: 4,
        },
      },
      modelos3D: {
        create: {
          nome: 'Modelo placa-mãe E2E',
          arquivoUrl: `/modelos-e2e/placa-mae-${sufixo}.glb`,
          formato: FormatoModelo3D.GLB,
          ativo: true,
          aprovado: true,
        },
      },
    },
    include: {
      especificacaoPlacaMae: true,
      modelos3D: true,
    },
  });

  if (!placaMae.especificacaoPlacaMae) {
    throw new Error('Falha ao criar especificação da placa-mãe E2E.');
  }

  await prisma.slotM2PlacaMae.create({
    data: {
      especificacaoPlacaMaeId: placaMae.especificacaoPlacaMae.id,
      codigo: 'M2_1',
      interfacesSuportadas: [InterfaceArmazenamento.NVME_PCIE],
      chavesSuportadas: [ChaveM2.M],
      tamanhosSuportadosMm: [2280],
      geracaoPcieMaxima: 4,
      pistasPcie: 4,
      ativo: true,
    },
  });

  const processador = await prisma.hardware.create({
    data: {
      nome: `Processador E2E ${sufixo}`,
      slug: `processador-e2e-${sufixo}`,
      categoria: CategoriaHardware.PROCESSADOR,
      marca: 'CriaByte Testes',
      modelo: `CPU-${sufixo}`,
      publicado: true,
      ativo: true,
      especificacaoProcessador: {
        create: {
          socket: 'AM5',
          nucleos: 6,
          threads: 12,
          frequenciaBaseMhz: 3800,
          frequenciaTurboMhz: 5000,
          tdpWatts: 65,
          possuiVideoIntegrado: true,
          tiposMemoriaSuportados: [TipoMemoria.DDR5],
          frequenciaMemoriaMaximaMhz: 5600,
          capacidadeMemoriaMaximaGb: 128,
          canaisMemoria: 2,
        },
      },
      modelos3D: {
        create: {
          nome: 'Modelo processador E2E',
          arquivoUrl: `/modelos-e2e/processador-${sufixo}.glb`,
          formato: FormatoModelo3D.GLB,
          ativo: true,
          aprovado: true,
        },
      },
    },
    include: { modelos3D: true },
  });

  const memoriaRam = await prisma.hardware.create({
    data: {
      nome: `Kit RAM E2E ${sufixo}`,
      slug: `ram-e2e-${sufixo}`,
      categoria: CategoriaHardware.MEMORIA_RAM,
      marca: 'CriaByte Testes',
      modelo: `RAM-${sufixo}`,
      publicado: true,
      ativo: true,
      especificacaoMemoriaRam: {
        create: {
          tipo: TipoMemoria.DDR5,
          formato: FormatoMemoria.DIMM,
          capacidadePorModuloGb: 8,
          quantidadeModulos: 2,
          frequenciaMhz: 5600,
          frequenciaJedecMhz: 5600,
          latenciaCl: 36,
          tensaoVolts: 1.25,
          consumoWatts: 4,
        },
      },
      modelos3D: {
        create: {
          nome: 'Modelo RAM E2E',
          arquivoUrl: `/modelos-e2e/ram-${sufixo}.glb`,
          formato: FormatoModelo3D.GLB,
          ativo: true,
          aprovado: true,
        },
      },
    },
    include: { modelos3D: true },
  });

  const placaVideo = await prisma.hardware.create({
    data: {
      nome: `GPU E2E ${sufixo}`,
      slug: `gpu-e2e-${sufixo}`,
      categoria: CategoriaHardware.PLACA_VIDEO,
      marca: 'CriaByte Testes',
      modelo: `GPU-${sufixo}`,
      publicado: true,
      ativo: true,
      especificacaoPlacaVideo: {
        create: {
          memoriaVideoGb: 8,
          comprimentoMm: 250,
          alturaMm: 120,
          espessuraMm: 45,
          slotsOcupados: 2,
          consumoWatts: 180,
          potenciaFonteRecomendadaWatts: 550,
          conectoresPcie8Pinos: 1,
          hdmi: 1,
          displayPort: 3,
        },
      },
      modelos3D: {
        create: {
          nome: 'Modelo GPU E2E',
          arquivoUrl: `/modelos-e2e/gpu-${sufixo}.glb`,
          formato: FormatoModelo3D.GLB,
          ativo: true,
          aprovado: true,
        },
      },
    },
    include: { modelos3D: true },
  });

  const armazenamento = await prisma.hardware.create({
    data: {
      nome: `SSD M.2 E2E ${sufixo}`,
      slug: `ssd-e2e-${sufixo}`,
      categoria: CategoriaHardware.ARMAZENAMENTO,
      marca: 'CriaByte Testes',
      modelo: `SSD-${sufixo}`,
      publicado: true,
      ativo: true,
      especificacaoArmazenamento: {
        create: {
          tipo: TipoArmazenamento.SSD,
          formato: FormatoArmazenamento.M2,
          interface: InterfaceArmazenamento.NVME_PCIE,
          capacidadeGb: 1000,
          tamanhoM2Mm: 2280,
          chaveM2: ChaveM2.M,
          geracaoPcie: 4,
          pistasPcie: 4,
          consumoWatts: 6,
        },
      },
      modelos3D: {
        create: {
          nome: 'Modelo SSD E2E',
          arquivoUrl: `/modelos-e2e/ssd-${sufixo}.glb`,
          formato: FormatoModelo3D.GLB,
          ativo: true,
          aprovado: true,
        },
      },
    },
    include: { modelos3D: true },
  });

  const fonte = await prisma.hardware.create({
    data: {
      nome: `Fonte E2E ${sufixo}`,
      slug: `fonte-e2e-${sufixo}`,
      categoria: CategoriaHardware.FONTE,
      marca: 'CriaByte Testes',
      modelo: `PSU-${sufixo}`,
      publicado: true,
      ativo: true,
      especificacaoFonte: {
        create: {
          formato: FormatoFonte.ATX,
          potenciaWatts: 750,
          comprimentoMm: 150,
          conectoresAtx24Pinos: 1,
          conectoresEpsCpu: 2,
          conectoresPcie8Pinos: 3,
          conectoresSata: 6,
        },
      },
      modelos3D: {
        create: {
          nome: 'Modelo fonte E2E',
          arquivoUrl: `/modelos-e2e/fonte-${sufixo}.glb`,
          formato: FormatoModelo3D.GLB,
          ativo: true,
          aprovado: true,
        },
      },
    },
    include: { modelos3D: true },
  });

  const cooler = await prisma.hardware.create({
    data: {
      nome: `Cooler E2E ${sufixo}`,
      slug: `cooler-e2e-${sufixo}`,
      categoria: CategoriaHardware.COOLER,
      marca: 'CriaByte Testes',
      modelo: `COOLER-${sufixo}`,
      publicado: true,
      ativo: true,
      especificacaoCooler: {
        create: {
          tipo: TipoCooler.AIR_COOLER,
          socketsSuportados: ['AM5'],
          capacidadeTermicaWatts: 180,
          alturaMm: 155,
          consumoWatts: 5,
        },
      },
      modelos3D: {
        create: {
          nome: 'Modelo cooler E2E',
          arquivoUrl: `/modelos-e2e/cooler-${sufixo}.glb`,
          formato: FormatoModelo3D.GLB,
          ativo: true,
          aprovado: true,
        },
      },
    },
    include: { modelos3D: true },
  });

  const ventoinha = await prisma.hardware.create({
    data: {
      nome: `Ventoinha E2E ${sufixo}`,
      slug: `ventoinha-e2e-${sufixo}`,
      categoria: CategoriaHardware.VENTOINHA,
      marca: 'CriaByte Testes',
      modelo: `FAN-${sufixo}`,
      publicado: true,
      ativo: true,
      especificacaoVentoinha: {
        create: {
          tamanhoMm: 120,
          espessuraMm: 25,
          rpmMaxima: 1500,
          fluxoArCfm: 55,
          conector: TipoConectorVentoinha.PWM_4_PINOS,
          tensaoVolts: 12,
          correnteAmperes: 0.2,
          pwm: true,
        },
      },
      modelos3D: {
        create: {
          nome: 'Modelo ventoinha E2E',
          arquivoUrl: `/modelos-e2e/ventoinha-${sufixo}.glb`,
          formato: FormatoModelo3D.GLB,
          ativo: true,
          aprovado: true,
        },
      },
    },
    include: { modelos3D: true },
  });

  await prisma.compatibilidadeCpuPlacaMae.create({
    data: {
      placaMaeId: placaMae.id,
      processadorId: processador.id,
      compativel: true,
      observacao: 'Fixture E2E compatível.',
      verificadoEm: new Date(),
    },
  });

  await prisma.compatibilidadeMemoriaPlacaMae.create({
    data: {
      placaMaeId: placaMae.id,
      memoriaRamId: memoriaRam.id,
      frequenciaValidadaMhz: 5600,
      quantidadeModulosTestados: 2,
      capacidadeTotalTestadaGb: 16,
      compativel: true,
      constaNaQvl: true,
      observacao: 'Fixture E2E compatível.',
      verificadoEm: new Date(),
    },
  });

  const [
    pontoPlacaMae,
    pontoFonte,
    pontoGpu,
    pontoFan1,
    pontoFan2,
    pontoFan3,
    pontoCpu,
    pontoRam1,
    pontoRam2,
    pontoCooler,
    pontoM2,
  ] = await Promise.all([
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: gabinete.id,
        codigo: `placa-mae-${sufixo}`,
        categoriaAceita: CategoriaHardware.PLACA_MAE,
        ordem: 1,
      },
    }),
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: gabinete.id,
        codigo: `fonte-${sufixo}`,
        categoriaAceita: CategoriaHardware.FONTE,
        ordem: 2,
      },
    }),
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: gabinete.id,
        codigo: `gpu-${sufixo}`,
        categoriaAceita: CategoriaHardware.PLACA_VIDEO,
        ordem: 3,
      },
    }),
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: gabinete.id,
        codigo: `frente-fan-1-${sufixo}`,
        categoriaAceita: CategoriaHardware.VENTOINHA,
        ordem: 4,
      },
    }),
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: gabinete.id,
        codigo: `frente-fan-2-${sufixo}`,
        categoriaAceita: CategoriaHardware.VENTOINHA,
        ordem: 5,
      },
    }),
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: gabinete.id,
        codigo: `frente-fan-3-${sufixo}`,
        categoriaAceita: CategoriaHardware.VENTOINHA,
        ordem: 6,
      },
    }),
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: placaMae.id,
        codigo: `cpu-${sufixo}`,
        categoriaAceita: CategoriaHardware.PROCESSADOR,
        ordem: 1,
      },
    }),
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: placaMae.id,
        codigo: `ram-1-${sufixo}`,
        categoriaAceita: CategoriaHardware.MEMORIA_RAM,
        ordem: 2,
      },
    }),
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: placaMae.id,
        codigo: `ram-2-${sufixo}`,
        categoriaAceita: CategoriaHardware.MEMORIA_RAM,
        ordem: 3,
      },
    }),
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: placaMae.id,
        codigo: `cooler-${sufixo}`,
        categoriaAceita: CategoriaHardware.COOLER,
        ordem: 4,
      },
    }),
    prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId: placaMae.id,
        codigo: `m2-1-${sufixo}`,
        categoriaAceita: CategoriaHardware.ARMAZENAMENTO,
        ordem: 5,
      },
    }),
  ]);

  return {
    hardwares: {
      gabineteId: gabinete.id,
      placaMaeId: placaMae.id,
      processadorId: processador.id,
      memoriaRamId: memoriaRam.id,
      placaVideoId: placaVideo.id,
      armazenamentoId: armazenamento.id,
      fonteId: fonte.id,
      coolerId: cooler.id,
      ventoinhaId: ventoinha.id,
    },
    pontos: {
      placaMae: pontoPlacaMae.id,
      fonte: pontoFonte.id,
      gpu: pontoGpu.id,
      fan1: pontoFan1.id,
      fan2: pontoFan2.id,
      fan3: pontoFan3.id,
      cpu: pontoCpu.id,
      ram1: pontoRam1.id,
      ram2: pontoRam2.id,
      cooler: pontoCooler.id,
      m2: pontoM2.id,
    },
    modelos3D: {
      placaMaeId: placaMae.modelos3D[0].id,
      processadorId: processador.modelos3D[0].id,
      memoriaRamId: memoriaRam.modelos3D[0].id,
      placaVideoId: placaVideo.modelos3D[0].id,
      armazenamentoId: armazenamento.modelos3D[0].id,
      fonteId: fonte.modelos3D[0].id,
      coolerId: cooler.modelos3D[0].id,
      ventoinhaId: ventoinha.modelos3D[0].id,
    },
    todosHardwareIds: [
      gabinete.id,
      placaMae.id,
      processador.id,
      memoriaRam.id,
      placaVideo.id,
      armazenamento.id,
      fonte.id,
      cooler.id,
      ventoinha.id,
    ],
  };
}

export function componentesBuildFixture(fixture: FixturePcCompleto) {
  return [
    {
      hardwareId: fixture.hardwares.processadorId,
      categoria: CategoriaHardware.PROCESSADOR,
      quantidade: 1,
    },
    {
      hardwareId: fixture.hardwares.placaMaeId,
      categoria: CategoriaHardware.PLACA_MAE,
      quantidade: 1,
    },
    {
      hardwareId: fixture.hardwares.memoriaRamId,
      categoria: CategoriaHardware.MEMORIA_RAM,
      quantidade: 1,
    },
    {
      hardwareId: fixture.hardwares.placaVideoId,
      categoria: CategoriaHardware.PLACA_VIDEO,
      quantidade: 1,
    },
    {
      hardwareId: fixture.hardwares.armazenamentoId,
      categoria: CategoriaHardware.ARMAZENAMENTO,
      quantidade: 1,
    },
    {
      hardwareId: fixture.hardwares.fonteId,
      categoria: CategoriaHardware.FONTE,
      quantidade: 1,
    },
    {
      hardwareId: fixture.hardwares.gabineteId,
      categoria: CategoriaHardware.GABINETE,
      quantidade: 1,
    },
    {
      hardwareId: fixture.hardwares.coolerId,
      categoria: CategoriaHardware.COOLER,
      quantidade: 1,
    },
    {
      hardwareId: fixture.hardwares.ventoinhaId,
      categoria: CategoriaHardware.VENTOINHA,
      quantidade: 3,
      posicao: 'FRENTE',
    },
  ];
}

export function itensMontagemCompletaFixture(fixture: FixturePcCompleto) {
  return [
    {
      instanciaId: 'placa-mae-1',
      pontoEncaixeId: fixture.pontos.placaMae,
      hardwareFilhoId: fixture.hardwares.placaMaeId,
    },
    {
      instanciaId: 'fonte-1',
      pontoEncaixeId: fixture.pontos.fonte,
      hardwareFilhoId: fixture.hardwares.fonteId,
    },
    {
      instanciaId: 'cooler-1',
      instanciaPaiId: 'placa-mae-1',
      pontoEncaixeId: fixture.pontos.cooler,
      hardwareFilhoId: fixture.hardwares.coolerId,
    },
    {
      instanciaId: 'processador-1',
      instanciaPaiId: 'placa-mae-1',
      pontoEncaixeId: fixture.pontos.cpu,
      hardwareFilhoId: fixture.hardwares.processadorId,
    },
    {
      instanciaId: 'ram-1',
      instanciaPaiId: 'placa-mae-1',
      pontoEncaixeId: fixture.pontos.ram1,
      hardwareFilhoId: fixture.hardwares.memoriaRamId,
    },
    {
      instanciaId: 'ram-2',
      instanciaPaiId: 'placa-mae-1',
      pontoEncaixeId: fixture.pontos.ram2,
      hardwareFilhoId: fixture.hardwares.memoriaRamId,
    },
    {
      instanciaId: 'gpu-1',
      pontoEncaixeId: fixture.pontos.gpu,
      hardwareFilhoId: fixture.hardwares.placaVideoId,
    },
    {
      instanciaId: 'armazenamento-1',
      instanciaPaiId: 'placa-mae-1',
      pontoEncaixeId: fixture.pontos.m2,
      hardwareFilhoId: fixture.hardwares.armazenamentoId,
    },
    {
      instanciaId: 'ventoinha-1',
      pontoEncaixeId: fixture.pontos.fan1,
      hardwareFilhoId: fixture.hardwares.ventoinhaId,
    },
    {
      instanciaId: 'ventoinha-2',
      pontoEncaixeId: fixture.pontos.fan2,
      hardwareFilhoId: fixture.hardwares.ventoinhaId,
    },
    {
      instanciaId: 'ventoinha-3',
      pontoEncaixeId: fixture.pontos.fan3,
      hardwareFilhoId: fixture.hardwares.ventoinhaId,
    },
  ];
}

export async function limparFixturePcCompleto(
  prisma: PrismaService,
  fixture: FixturePcCompleto,
): Promise<void> {
  const buildProdutos = await prisma.build.findMany({
    where: {
      componentes: {
        some: { hardwareId: { in: fixture.todosHardwareIds } },
      },
    },
    select: { produtoId: true },
  });

  if (buildProdutos.length > 0) {
    await prisma.produto.deleteMany({
      where: { id: { in: buildProdutos.map((item) => item.produtoId) } },
    });
  }

  await prisma.montagem.deleteMany({
    where: {
      OR: [
        { gabineteId: { in: fixture.todosHardwareIds } },
        { fonteId: { in: fixture.todosHardwareIds } },
        { coolerId: { in: fixture.todosHardwareIds } },
        {
          itens: {
            some: { hardwareFilhoId: { in: fixture.todosHardwareIds } },
          },
        },
      ],
    },
  });

  await prisma.hardware.deleteMany({
    where: { id: { in: fixture.todosHardwareIds } },
  });
}
