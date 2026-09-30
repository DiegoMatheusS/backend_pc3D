import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CriarEspecificacaoPlacaMaeDto } from './criar-especificacao-placa-mae.dto';

describe('CriarEspecificacaoPlacaMaeDto - frequências de memória', () => {
  function criarDto(overrides: Record<string, unknown> = {}) {
    return plainToInstance(CriarEspecificacaoPlacaMaeDto, {
      socket: 'AM5',
      chipset: 'B650',
      formato: 'ATX',
      tiposMemoriaSuportados: ['DDR5'],
      frequenciasMemoriaJedecMhz: [5200, 5600],
      frequenciasMemoriaOverclockMhz: [6000],
      slotsMemoria: 4,
      saidasVideo: [],
      ...overrides,
    });
  }

  it('remove valores absurdos sem derrubar o payload válido', () => {
    const dto = criarDto({
      frequenciasMemoriaJedecMhz: [5200, 5_200_000, 5600, 1_000_001],
      frequenciasMemoriaOverclockMhz: [7600, 7_600_000],
    });

    expect(dto.frequenciasMemoriaJedecMhz).toEqual([5200, 5600]);
    expect(dto.frequenciasMemoriaOverclockMhz).toEqual([7600]);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('entende frequências em texto e elimina duplicados', () => {
    const dto = criarDto({
      frequenciasMemoriaJedecMhz: ['DDR5-5200', '5600 MT/s', '5200'],
      frequenciasMemoriaOverclockMhz: ['DDR5-6000', '6000 MHz', '7600'],
    });

    expect(dto.frequenciasMemoriaJedecMhz).toEqual([5200, 5600]);
    expect(dto.frequenciasMemoriaOverclockMhz).toEqual([6000, 7600]);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('converte uma lista totalmente corrompida em lista vazia em vez de gerar erro de limite', () => {
    const dto = criarDto({
      frequenciasMemoriaJedecMhz: [5_200_000, 9_999_999],
      frequenciasMemoriaOverclockMhz: [7_600_000],
    });

    expect(dto.frequenciasMemoriaJedecMhz).toEqual([]);
    expect(dto.frequenciasMemoriaOverclockMhz).toEqual([]);
    expect(validateSync(dto)).toHaveLength(0);
  });
});
