import { ProdutoIaPythonService } from '../ia/produto-ia-python.service';
import { ProdutosService } from './produtos.service';
import { ProdutoEspecificacoesService } from './produto-especificacoes.service';

describe('Busca de especificações do Produto', () => {
  function setup(ofertas: unknown[] = []) {
    const produto = {
      id: 7,
      nome: 'Samsung Galaxy Teste',
      marca: 'Samsung',
      modelo: 'Galaxy Teste',
      categoria: { slug: 'celulares' },
      metadados: {
        asin: 'EXISTENTE',
        especificacoes: { nfc: false, ramGb: 8 },
      },
      descricao: '',
      hardware: null,
      notebook: null,
      build: null,
      ofertas,
    };
    const produtos = {
      buscarAdmin: jest.fn().mockResolvedValue(produto),
      atualizar: jest.fn(),
    };
    const ia = {
      importarUrl: jest
        .fn()
        .mockResolvedValue({
          categoriaDetectada: 'CELULAR',
          payloadParcialBackend: {
            modelo: 'Galaxy Teste',
            descricao: 'Descrição da página',
            especificacaoCelular: { ramGb: 12, bateriaMah: 5000 },
          },
        }),
      enriquecerIaTecnica: jest
        .fn()
        .mockResolvedValue({
          payload: {
            especificacaoCelular: {
              nfc: true,
              ramGb: 12,
              armazenamentoGb: 256,
            },
          },
          origemPorCampo: {
            armazenamentoGb: {
              fonte: 'FABRICANTE_OFICIAL',
              url: 'https://samsung.com/modelo',
            },
          },
        }),
    };
    const service = new ProdutoEspecificacoesService(
      produtos as unknown as ProdutosService,
      ia as unknown as ProdutoIaPythonService,
    );
    return { service, produtos, ia, produto };
  }

  it('preenche apenas lacunas, preserva false e retorna prévia sem gravar', async () => {
    const { service, produtos, ia } = setup([
      { status: 'ATIVA', urlOriginal: 'https://loja.example/modelo' },
    ]);
    const result = await service.buscar(7, { usarIa: true });
    expect(result.especificacoes).toEqual({
      bateriaMah: 5000,
      armazenamentoGb: 256,
    });
    expect(result.descricao).toBe('Descrição da página');
    expect(ia.enriquecerIaTecnica).toHaveBeenCalledWith(
      expect.objectContaining({
        provedor: 'OPENAI',
        payload: expect.objectContaining({
          especificacaoCelular: { nfc: false, ramGb: 8, bateriaMah: 5000 },
        }) as unknown,
      }),
    );
    expect(result.nenhumRegistroAlterado).toBe(true);
    expect(produtos.atualizar).not.toHaveBeenCalled();
  });

  it('usa pesquisa de fontes sem IA quando a opção estiver desligada', async () => {
    const { service, ia } = setup();
    await service.buscar(7, { usarIa: false });
    expect(ia.enriquecerIaTecnica).toHaveBeenCalledWith(
      expect.objectContaining({ provedor: 'PROJETO_IA' }),
    );
    expect(ia.importarUrl).not.toHaveBeenCalled();
  });

  it('mantém a coleta quando a pesquisa complementar falha', async () => {
    const { service, ia } = setup([
      { status: 'ATIVA', urlOriginal: 'https://loja.example/modelo' },
    ]);
    ia.enriquecerIaTecnica.mockRejectedValue(new Error('Indisponível'));
    const result = await service.buscar(7, {});
    expect(result.especificacoes).toEqual({ bateriaMah: 5000 });
    expect(result.avisos).toHaveLength(1);
  });

  it('ignora outro modelo e preserva a descrição já escrita', async () => {
    const { service, ia, produto } = setup([
      { status: 'ATIVA', urlOriginal: 'https://loja.example/modelo' },
    ]);
    produto.descricao = 'Texto escrito pelo editor';
    ia.importarUrl.mockResolvedValue({
      categoriaDetectada: 'CELULAR',
      payloadParcialBackend: {
        modelo: 'Outro modelo',
        descricao: 'Errada',
        especificacaoCelular: { ramGb: 12, bateriaMah: 9999 },
      },
    });
    const result = await service.buscar(7, {});
    expect(result.especificacoes).toEqual({ armazenamentoGb: 256 });
    expect(result.descricao).toBe('');
    expect(result.avisos).toHaveLength(1);
  });
});
