import { IaService } from './ia.service';
import { PrismaService } from '../prisma/prisma.service';
import { IaProvider } from './ia.provider';
import { ProdutoIaPythonService } from './produto-ia-python.service';
import { HardwaresService } from '../hardwares/hardwares.service';

describe('descrição técnica da IA administrativa', () => {
  function setup(especificacaoMouse: Record<string, unknown> | null) {
    const produto = {
      nome: 'Mouse Logitech G502 HERO foi desenvolvido para vencer.',
      marca: 'Logitech',
      modelo: 'G502 HERO',
      hardware: null,
      notebook: null,
      metadados: {},
      especificacaoMouse,
    };
    const prisma = {
      produto: { findUnique: jest.fn().mockResolvedValue(produto) },
    };
    const service = new IaService(
      prisma as unknown as PrismaService,
      {} as IaProvider,
      {} as ProdutoIaPythonService,
      {} as HardwaresService,
    );
    const llm = jest
      .spyOn(service, 'gerarRespostaChat')
      .mockRejectedValue(
        new Error('Não deve gerar fatos com um modelo de linguagem'),
      );
    return { service, llm };
  }
  it('usa a ficha cadastrada, exclui IDs e preserva os valores falsos', async () => {
    const { service, llm } = setup({
      id: 9,
      produtoId: 7,
      dpiMaximo: 25600,
      pesoGramas: 121,
      wireless: false,
    });
    const result = await service.gerarDescricao({ produtoId: 7 });
    expect(result.descricao).toContain('Mouse Logitech G502 HERO');
    expect(result.descricao).toContain('25600');
    expect(result.descricao).toContain('121 g');
    expect(result.descricao).toContain('Não');
    expect(result.descricao).not.toContain('foi desenvolvido');
    expect(result.descricao).not.toContain('ProdutoId');
    expect(llm).not.toHaveBeenCalled();
  });
  it('pede a ficha quando não existem especificações', async () => {
    const { service, llm } = setup(null);
    await expect(service.gerarDescricao({ produtoId: 7 })).rejects.toThrow(
      'especificações',
    );
    expect(llm).not.toHaveBeenCalled();
  });
});
