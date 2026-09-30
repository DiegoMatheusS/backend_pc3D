import { ProdutoIaIntegracaoInternaController } from './produto-ia-integracao-interna.controller';
import { ProdutoIaIntegracaoInternaService } from './produto-ia-integracao-interna.service';

describe('Pré-busca da extensão para computadores completos', () => {
  const secret = 'teste-chave-prebusca-pc';
  let originalKey: string | undefined;

  beforeAll(() => {
    originalKey = process.env.PRODUTO_IA_API_KEY;
    process.env.PRODUTO_IA_API_KEY = secret;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.PRODUTO_IA_API_KEY;
    else process.env.PRODUTO_IA_API_KEY = originalKey;
  });

  const computerTitle = 'Computador Intel Core i5 3470 16GB RAM SSD 120GB Windows 10';

  function setup(found: object) {
    const service = {
      buscarItemExtensao: jest.fn().mockResolvedValue(found),
    };
    const controller = new ProdutoIaIntegracaoInternaController(
      service as unknown as ProdutoIaIntegracaoInternaService,
    );
    return { controller, service };
  }

  it('não associa um computador a um processador com a mesma marca/modelo', async () => {
    const { controller } = setup({
      status: 'EXISTENTE',
      tipo: 'HARDWARE',
      hardwareId: 42,
      criterio: 'MARCA_MODELO',
      item: { id: 42, nome: 'Processador Intel Core i5-3470' },
    });

    const result = await controller.buscarItem(secret, {
      nome: computerTitle,
      marca: 'Intel',
      modelo: 'Core i5-3470',
    });

    expect(result.status).toBe('AMBIGUO');
    expect(result).not.toHaveProperty('hardwareId');
  });

  it('exige revisão quando a configuração existente tem outra capacidade', async () => {
    const { controller } = setup({
      status: 'EXISTENTE',
      tipo: 'PRODUTO',
      produtoId: 72,
      criterio: 'MARCA_MODELO',
      item: { id: 72, nome: 'Computador Intel Core i5 3470 8GB RAM SSD 120GB Windows 10' },
    });
    const result = await controller.buscarItem(secret, { nome: computerTitle });
    expect(result.status).toBe('AMBIGUO');
  });

  it('permite uma correspondência com o mesmo título de computador completo', async () => {
    const existing = {
      status: 'EXISTENTE',
      tipo: 'PRODUTO',
      produtoId: 78,
      criterio: 'NOME_MARCA',
      item: { id: 78, nome: computerTitle },
    };
    const { controller } = setup(existing);
    const result = await controller.buscarItem(secret, { nome: computerTitle });
    expect(result).toEqual(existing);
  });

  it('mantém a busca normal para CPUs vendidas separadamente', async () => {
    const existing = {
      status: 'EXISTENTE',
      tipo: 'HARDWARE',
      hardwareId: 42,
      criterio: 'MARCA_MODELO',
      item: { id: 42, nome: 'Processador Intel Core i5-3470' },
    };
    const { controller } = setup(existing);
    const result = await controller.buscarItem(secret, {
      nome: 'Processador Intel Core i5-3470',
      marca: 'Intel',
      modelo: 'Core i5-3470',
    });
    expect(result).toEqual(existing);
  });
});
