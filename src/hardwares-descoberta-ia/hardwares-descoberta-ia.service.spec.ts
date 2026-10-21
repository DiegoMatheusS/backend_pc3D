import { CategoriaHardware } from '../generated/prisma/enums';
import { HardwaresDescobertaIaService } from './hardwares-descoberta-ia.service';

describe('HardwaresDescobertaIaService - IA técnica', () => {
  it('preserva o payload normalizado devolvido pelo ProjetoIA', async () => {
    const produtoIa = {
      enriquecerIaTecnica: jest.fn().mockResolvedValue({
        utilizado: true,
        provedor: 'OPENAI',
        categoria: CategoriaHardware.PLACA_MAE,
        coberturaAntes: 0.7,
        coberturaDepois: 0.9,
        camposPreenchidos: ['frequenciasMemoriaJedecMhz'],
        camposAusentes: [],
        statusFicha: 'PRONTO',
        payload: {
          nome: 'ASUS PRIME B650-PLUS WIFI',
          marca: 'ASUS',
          modelo: 'PRIME B650-PLUS WIFI',
          categoria: CategoriaHardware.PLACA_MAE,
          especificacaoPlacaMae: {
            socket: 'AM5',
            chipset: 'B650',
            formato: 'ATX',
            frequenciasMemoriaJedecMhz: [5200, 5600],
          },
        },
      }),
    };

    const service = new HardwaresDescobertaIaService(
      {} as never,
      produtoIa as never,
      {} as never,
    );

    const resultado = await service.enriquecerIaTecnica({
      provedor: 'OPENAI',
      categoria: CategoriaHardware.PLACA_MAE,
      nome: 'ASUS PRIME B650-PLUS WIFI',
      somentePreencheLacunas: true,
      payload: {
        nome: 'ASUS PRIME B650-PLUS WIFI',
        marca: 'ASUS',
        modelo: 'PRIME B650-PLUS WIFI',
        categoria: CategoriaHardware.PLACA_MAE,
        especificacaoPlacaMae: {
          socket: 'AM5',
          chipset: 'B650',
          formato: 'ATX',
          frequenciasMemoriaJedecMhz: [5_200_000],
        },
      },
    });

    expect(resultado.payload).toMatchObject({
      especificacaoPlacaMae: {
        frequenciasMemoriaJedecMhz: [5200, 5600],
      },
    });
    expect(produtoIa.enriquecerIaTecnica).toHaveBeenCalledTimes(1);
  });
});

describe('HardwaresDescobertaIaService - descoberta ampliada', () => {
  const existing = {
    id: 1,
    nome: 'Intel Core i5-9400F',
    marca: 'Intel',
    modelo: 'Core i5-9400F',
    mpn: null,
    gtin: null,
    categoria: CategoriaHardware.PROCESSADOR,
  };

  it('envia o catálogo atualizado antes de buscar e preserva continuação e diagnóstico', async () => {
    const prisma = {
      hardware: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            existing,
            {
              ...existing,
              id: 2,
              nome: 'RX 580',
              categoria: CategoriaHardware.PLACA_VIDEO,
            },
          ]),
      },
    };
    const produtoIa = {
      descobrirHardwares: jest.fn().mockResolvedValue({
        itens: [
          {
            payload: {
              nome: 'Intel Core i5-9500',
              marca: 'Intel',
              modelo: 'Core i5-9500',
              categoria: CategoriaHardware.PROCESSADOR,
            },
          },
        ],
        jaCadastradosIgnorados: 100,
        exclusaoAntesDaPaginacao: true,
        temMais: true,
        limiteCandidatos: 2000,
        buscaParcial: true,
        fontesConsultadas: [
          { fonte: 'CPU_WORLD', encontrados: 0, erro: 'HTTP_403' },
        ],
      }),
    };
    const service = new HardwaresDescobertaIaService(
      prisma as never,
      produtoIa as never,
      {} as never,
    );
    const result = await service.descobrir({
      categoria: CategoriaHardware.PROCESSADOR,
      consulta: ' i5-9500 ',
      limite: 100,
    });
    expect(produtoIa.descobrirHardwares).toHaveBeenCalledWith({
      categoria: CategoriaHardware.PROCESSADOR,
      marca: undefined,
      consulta: 'i5-9500',
      pagina: 1,
      limite: 100,
      hardwaresCadastrados: [
        { nome: existing.nome, marca: existing.marca, modelo: existing.modelo },
      ],
    });
    expect(prisma.hardware.findMany.mock.invocationCallOrder[0]).toBeLessThan(
      produtoIa.descobrirHardwares.mock.invocationCallOrder[0],
    );
    expect(result).toMatchObject({
      novos: 1,
      totalEncontrados: 101,
      jaCadastrados: 100,
      temMais: true,
      proximaPagina: 2,
      buscaParcial: true,
      limiteCandidatos: 2000,
    });
    expect(result.fontesConsultadas).toEqual([
      { fonte: 'CPU_WORLD', encontrados: 0, erro: 'HTTP_403' },
    ]);
  });

  it('continua ocultando duplicados mesmo quando a IA ainda retorna um modelo cadastrado', async () => {
    const produtoIa = {
      descobrirHardwares: jest
        .fn()
        .mockResolvedValue({ itens: [{ payload: existing }], temMais: true }),
    };
    const service = new HardwaresDescobertaIaService(
      {
        hardware: { findMany: jest.fn().mockResolvedValue([existing]) },
      } as never,
      produtoIa as never,
      {} as never,
    );
    const result = await service.descobrir({
      categoria: CategoriaHardware.PROCESSADOR,
    });
    expect(result).toMatchObject({
      novos: 0,
      jaCadastrados: 1,
      temMais: true,
      proximaPagina: 2,
    });
    expect(result.itens).toEqual([]);
  });

  it('reconsulta o catálogo em cada busca após cadastrar um lote', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([existing]);
    const produtoIa = {
      descobrirHardwares: jest
        .fn()
        .mockResolvedValue({ itens: [], temMais: false }),
    };
    const service = new HardwaresDescobertaIaService(
      { hardware: { findMany } } as never,
      produtoIa as never,
      {} as never,
    );
    await service.descobrir({ categoria: CategoriaHardware.PROCESSADOR });
    await service.descobrir({ categoria: CategoriaHardware.PROCESSADOR });
    expect(
      produtoIa.descobrirHardwares.mock.calls[0][0].hardwaresCadastrados,
    ).toEqual([]);
    expect(
      produtoIa.descobrirHardwares.mock.calls[1][0].hardwaresCadastrados,
    ).toHaveLength(1);
  });
});
