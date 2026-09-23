import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CadastrarHardwareDescobertoDto } from './cadastrar-hardware-descoberto.dto';

function gabineteBase() {
  return {
    categoria: 'GABINETE',
    nome: 'Gabinete teste',
    marca: 'Teste',
    modelo: 'CASE-1',
    especificacaoGabinete: {
      tamanho: 'MID_TOWER',
      alturaMm: 450,
      larguraMm: 220,
      profundidadeMm: 430,
      formatosPlacaMaeSuportados: ['ATX'],
      formatosFonteSuportados: ['ATX'],
    },
  };
}

describe('limites de refrigeração no gabinete descoberto', () => {
  it('deduplica suportes repetidos de fan por posição e tamanho', () => {
    const payload = gabineteBase();
    payload.especificacaoGabinete.suportesFans = Array.from(
      { length: 40 },
      (_, indice) => ({
        posicao: indice % 2 === 0 ? 'FRENTE' : 'TOPO',
        tamanhoMm: 120,
        quantidadeMaxima: 3,
        observacao: `fonte ${indice}`,
      }),
    );

    const dto = plainToInstance(CadastrarHardwareDescobertoDto, { payload });
    expect(dto.payload.especificacaoGabinete?.suportesFans).toHaveLength(2);
    expect(validateSync(dto)).toEqual([]);
  });

  it('corta fans únicos em 32 antes do ArrayMaxSize', () => {
    const payload = gabineteBase();
    payload.especificacaoGabinete.suportesFans = Array.from(
      { length: 40 },
      (_, indice) => ({
        posicao: 'FRENTE',
        tamanhoMm: 80 + indice,
        quantidadeMaxima: 1,
      }),
    );

    const dto = plainToInstance(CadastrarHardwareDescobertoDto, { payload });
    expect(dto.payload.especificacaoGabinete?.suportesFans).toHaveLength(32);
    expect(validateSync(dto)).toEqual([]);
  });

  it('corta radiadores únicos em 16 antes do ArrayMaxSize', () => {
    const payload = gabineteBase();
    payload.especificacaoGabinete.suportesRadiador = Array.from(
      { length: 24 },
      (_, indice) => ({
        posicao: 'TOPO',
        tamanhoMm: 120 + indice,
      }),
    );

    const dto = plainToInstance(CadastrarHardwareDescobertoDto, { payload });
    expect(dto.payload.especificacaoGabinete?.suportesRadiador).toHaveLength(16);
    expect(validateSync(dto)).toEqual([]);
  });
});
