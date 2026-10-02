import 'reflect-metadata';
import { ChatbotAdminService } from './chatbot-admin.service';
import { AcaoChatbotCadastro } from './dtos/analisar-cadastro-chatbot.dto';
import type { ResultadoProdutoIaPython } from '../ia/produto-ia-python.service';

jest.mock('../common/security/external-http-security', () => ({
  validarUrlPublica: jest.fn((url: string) =>
    Promise.resolve({ url: new URL(url) }),
  ),
}));

describe('coleta de página no cadastro por link do chat', () => {
  it.each([
    [AcaoChatbotCadastro.CADASTRAR_PRODUTO, 'PC_MONTADO'],
    [AcaoChatbotCadastro.CADASTRAR_HARDWARE, 'MEMORIA_RAM'],
  ])(
    'ativa a coleta em %s e preserva os dados na prévia',
    async (acao, categoria) => {
      const prisma = {
        parceiro: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 11,
              nome: 'Shopee',
              slug: 'shopee',
              dominio: 'shopee.com.br',
            },
          ]),
        },
        categoriaProduto: {
          findUnique: jest.fn().mockResolvedValue({ id: 7 }),
        },
        hardware: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
        },
        produto: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
        },
        chatbotCadastroToken: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      const resultado: ResultadoProdutoIaPython = {
        categoriaDetectada: categoria,
        payloadParcialBackend: {
          nome: 'Item coletado',
          marca: 'Marca confirmada',
          modelo: 'Modelo confirmado',
          descricao: 'Descrição completa da página',
          imagemUrl: 'https://loja.example/item.jpg',
        },
        ofertaColetada: {
          preco: 2999.9,
          urlOriginal: 'https://shopee.com.br/product/123/456',
          urlAfiliada: 'https://shopee.com.br/affiliate',
        },
      };
      const python = { importarUrl: jest.fn().mockResolvedValue(resultado) };
      const service = new ChatbotAdminService(
        prisma as never,
        python as never,
        {} as never,
      );
      const result = await service.analisarCadastro(3, {
        acao,
        categoriaEsperada: categoria,
        url: 'https://shopee.com.br/product/123/456',
        urlAfiliada: 'https://shopee.com.br/affiliate',
      });
      expect(python.importarUrl).toHaveBeenCalledWith(
        'https://shopee.com.br/product/123/456',
        categoria,
        {
          enrich: true,
          criabytePlan: true,
          noBrowser: false,
          detalharPagina: true,
          urlAfiliada: 'https://shopee.com.br/affiliate',
        },
      );
      expect(result.analise.produto.dadosDetectados.descricao).toBe(
        'Descrição completa da página',
      );
      expect(result.analise.produto.dadosDetectados.imagemUrl).toBe(
        'https://loja.example/item.jpg',
      );
      expect(result.analise.oferta.dadosDetectados.preco).toBe(2999.9);
      expect(result.analise.oferta.dadosDetectados.urlAfiliada).toBe(
        'https://shopee.com.br/affiliate',
      );
      expect(result.status).toBe('AGUARDANDO_CONFIRMACAO');
    },
  );
});
