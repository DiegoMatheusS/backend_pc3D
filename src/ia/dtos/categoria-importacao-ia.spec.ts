import {
  CATEGORIAS_PRODUTO_IMPORTACAO_IA,
  ehCategoriaImportacaoIa,
} from './categoria-importacao-ia';

describe('categorias de Produto aceitas pela IA', () => {
  it.each([
    'CELULAR',
    'TABLET',
    'VIDEOGAME',
    'CAMERA',
    'ASPIRADOR_PO',
    'ROBO_ASPIRADOR',
    'SMART_SPEAKER',
    'CAMERA_SEGURANCA',
    'E_READER',
    'DRONE',
    'TV',
    'AIR_FRYER',
  ])('aceita %s como categoria comercial', (categoria) => {
    expect(ehCategoriaImportacaoIa(categoria)).toBe(true);
    expect(CATEGORIAS_PRODUTO_IMPORTACAO_IA).toContain(categoria);
  });

  it('não transforma uma categoria comercial em Hardware técnico', () => {
    expect(ehCategoriaImportacaoIa('ASPIRADOR_PO')).toBe(true);
    expect(ehCategoriaImportacaoIa('ROBO_ASPIRADOR')).toBe(true);
  });
});
