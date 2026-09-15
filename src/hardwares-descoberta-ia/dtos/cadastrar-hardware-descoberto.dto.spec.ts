import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CadastrarHardwareDescobertoDto } from './cadastrar-hardware-descoberto.dto';

describe('slots M.2 no cadastro descoberto', () => {
  it('normaliza contagem legada sem inventar interfaces e preserva tipos para validação', () => {
    const dto = plainToInstance(CadastrarHardwareDescobertoDto, {
      payload: { categoria: 'PLACA_MAE', nome: 'Placa teste', marca: 'Teste',
        especificacaoPlacaMae: { slotsM2: 2, tiposMemoriaSuportados: [] } },
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
          tiposMemoriaSuportados: [3200, 3466, 'DDR4', 'DDR4-3600', 'desconhecido'],
        },
      },
    });

    expect(dto.payload.especificacaoPlacaMae?.tiposMemoriaSuportados).toEqual(['DDR4']);
  });
});
