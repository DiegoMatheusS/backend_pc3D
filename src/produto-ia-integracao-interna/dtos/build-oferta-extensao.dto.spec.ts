import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BuildOfertaExtensaoDto } from './importar-oferta-extensao-produto-ia.dto';

describe('contrato de PC montado da extensão', () => {
  it('aceita descrição longa e somente a categoria PC_MONTADO', () => {
    const body = {
      nome: 'PC Gamer',
      categoria: 'PC_MONTADO',
      descricao: 'Configuração e garantia.\n'.repeat(300),
    };
    expect(
      validateSync(plainToInstance(BuildOfertaExtensaoDto, body)),
    ).toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(BuildOfertaExtensaoDto, {
          ...body,
          categoria: 'KIT_UPGRADE',
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'categoria' }),
      ]),
    );
  });
  it('não aceita componentes, publicação ou outra oferta dentro do buildPayload', () => {
    const dto = plainToInstance(BuildOfertaExtensaoDto, {
      nome: 'PC Gamer',
      descricao: 'RAM 16 GB e SSD 1 TB.',
      componentes: [{ hardwareId: 999 }],
      publicado: true,
      ativo: true,
      oferta: {},
      configuracao3D: {},
    });
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((error) => error.property).sort()).toEqual([
      'ativo',
      'componentes',
      'configuracao3D',
      'oferta',
      'publicado',
    ]);
  });
});
