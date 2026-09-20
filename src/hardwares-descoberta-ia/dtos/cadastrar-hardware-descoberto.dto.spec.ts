import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CadastrarHardwareDescobertoDto } from './cadastrar-hardware-descoberto.dto';

describe('slots M.2 no cadastro descoberto', () => {
  it('normaliza contagem legada sem inventar interfaces e preserva tipos para validação', () => {
    const dto = plainToInstance(CadastrarHardwareDescobertoDto, {
      payload: {
        categoria: 'PLACA_MAE',
        nome: 'Placa teste',
        marca: 'Teste',
        especificacaoPlacaMae: { slotsM2: 2, tiposMemoriaSuportados: [] },
      },
    });
    const slots = dto.payload.especificacaoPlacaMae?.slotsM2;
    expect(slots).toHaveLength(2);
    expect(slots?.[0].interfacesSuportadas).toEqual([]);
    expect(validateSync(slots![0])).toEqual([]);
  });

  it('remove frequencias do campo tiposMemoriaSuportados e preserva somente enums DDR', () => {
    const dto = plainToInstance(CadastrarHardwareDescobertoDto, {
      payload: {
        categoria: 'PLACA_MAE',
        nome: 'MSI B550-A Pro',
        marca: 'MSI',
        modelo: 'B550-A Pro',
        especificacaoPlacaMae: {
          tiposMemoriaSuportados: [
            3200,
            3466,
            'DDR4',
            'DDR4-3600',
            'desconhecido',
          ],
        },
      },
    });

    expect(dto.payload.especificacaoPlacaMae?.tiposMemoriaSuportados).toEqual([
      'DDR4',
    ]);
  });

  it('remove nulls de campos tecnicos opcionais antes de chegar ao Prisma', () => {
    const dto = plainToInstance(CadastrarHardwareDescobertoDto, {
      payload: {
        categoria: 'PLACA_MAE',
        nome: 'Placa com lacunas',
        marca: 'Teste',
        modelo: 'X1',
        especificacaoPlacaMae: {
          socket: 'AM5',
          chipset: 'B650',
          formato: 'ATX',
          tiposMemoriaSuportados: ['DDR5'],
          frequenciasMemoriaJedecMhz: [5200],
          frequenciasMemoriaOverclockMhz: [],
          slotsMemoria: 4,
          saidasVideo: [],
          formatosMemoriaSuportados: null,
          suportaXmp: null,
          suportaExpo: null,
          suportaEcc: null,
          suportaMemoriaRegistrada: null,
          portasSata: null,
          wifi: null,
          bluetooth: null,
          biosFlashback: null,
          slotsM2: null,
          biosInicial: null,
        },
      },
    });

    const placaMae = dto.payload.especificacaoPlacaMae as unknown as Record<
      string,
      unknown
    >;

    expect(placaMae.slotsM2).toBeUndefined();
    expect(placaMae.suportaXmp).toBeUndefined();
    expect(placaMae.portasSata).toBeUndefined();
    expect(placaMae.wifi).toBeUndefined();
    expect(placaMae.biosInicial).toBeUndefined();
    expect(validateSync(dto)).toEqual([]);
  });

  it('remove null dentro de objetos de slots M.2 sem descartar valores confirmados', () => {
    const dto = plainToInstance(CadastrarHardwareDescobertoDto, {
      payload: {
        categoria: 'PLACA_MAE',
        nome: 'Placa M2',
        marca: 'Teste',
        modelo: 'M2',
        especificacaoPlacaMae: {
          tiposMemoriaSuportados: ['DDR5'],
          slotsM2: [
            {
              codigo: 'M2_1',
              interfacesSuportadas: [],
              chavesSuportadas: [],
              tamanhosSuportadosMm: [],
              ativo: null,
              compartilhaCom: null,
            },
          ],
        },
      },
    });

    const slot = dto.payload.especificacaoPlacaMae?.slotsM2?.[0] as unknown as Record<
      string,
      unknown
    >;

    expect(slot.codigo).toBe('M2_1');
    expect(slot.ativo).toBeUndefined();
    expect(slot.compartilhaCom).toBeUndefined();
  });

  it('remove fluxoArCfm de cooler descoberto antes da validação', () => {
    const dto = plainToInstance(CadastrarHardwareDescobertoDto, {
      payload: {
        categoria: 'COOLER',
        nome: 'Cooler teste',
        marca: 'Teste',
        modelo: 'C1',
        especificacaoCooler: {
          tipo: 'AIR_COOLER',
          socketsSuportados: ['AM5'],
          velocidadeMaxRpm: 1850,
          fluxoArCfm: 66.17,
        },
      },
    });

    const cooler = dto.payload.especificacaoCooler as unknown as Record<
      string,
      unknown
    >;

    expect(cooler.fluxoArCfm).toBeUndefined();
    expect(cooler.velocidadeMaxRpm).toBe(1850);
    expect(validateSync(dto)).toEqual([]);
  });
});


describe('conector de ventoinha no cadastro descoberto', () => {
  it('infere PWM_4_PINOS quando a fonte confirmou pwm=true e deixou conector nulo', () => {
    const dto = plainToInstance(CadastrarHardwareDescobertoDto, {
      idTemporario: 'fractal-design-momentum-14-rgb-white-d688080b5c83',
      payload: {
        categoria: 'VENTOINHA',
        nome: 'Fractal Design Momentum 14 RGB White',
        marca: 'fractal design',
        modelo: 'Momentum 14 RGB White',
        especificacaoVentoinha: {
          tamanhoMm: 140,
          espessuraMm: 25,
          rpmMinima: 350,
          rpmMaxima: 1800,
          fluxoArCfm: 74.39,
          pressaoEstaticaMmH2o: 2.45,
          ruidoDb: 28,
          conector: null,
          tensaoVolts: 12,
          correnteAmperes: 0.17,
          pwm: true,
          rgb: true,
          argb: true,
          fluxoReverso: false,
        },
      },
    });

    expect(dto.payload.especificacaoVentoinha?.conector).toBe('PWM_4_PINOS');
    expect(validateSync(dto)).toEqual([]);
  });

  it('normaliza aliases textuais conhecidos de conector', () => {
    const dto = plainToInstance(CadastrarHardwareDescobertoDto, {
      payload: {
        categoria: 'VENTOINHA',
        nome: 'Fan teste',
        marca: 'Teste',
        modelo: 'F1',
        especificacaoVentoinha: {
          tamanhoMm: 120,
          conector: '4-pin',
          pwm: true,
        },
      },
    });

    expect(dto.payload.especificacaoVentoinha?.conector).toBe('PWM_4_PINOS');
    expect(validateSync(dto)).toEqual([]);
  });
});
