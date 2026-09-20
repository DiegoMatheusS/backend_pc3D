import { postProdutoIa } from '../ia/produto-ia-http';
import { MercadoLivreProjetoIaService } from './mercadolivre-projeto-ia.service';

jest.mock('../ia/produto-ia-http', () => ({
  postProdutoIa: jest.fn(),
}));

const postProdutoIaMock = postProdutoIa as jest.MockedFunction<typeof postProdutoIa>;

describe('MercadoLivreProjetoIaService', () => {
  const tx = {
    oferta: { update: jest.fn() },
    historicoPrecoOferta: { create: jest.fn() },
  };
  const prisma = {
    oferta: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  let service: MercadoLivreProjetoIaService;

  beforeEach(() => {
    process.env.PRODUTO_IA_URL = 'https://produto-ia.example.com';
    process.env.PRODUTO_IA_API_KEY = 'chave-interna';
    service = new MercadoLivreProjetoIaService(prisma as never);
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.PRODUTO_IA_URL;
    delete process.env.PRODUTO_IA_API_KEY;
  });

  it('consulta o anúncio exato pelo ProjetoIA', async () => {
    postProdutoIaMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          agente: 'MERCADO_LIVRE_OFERTAS',
          item: {
            itemId: 'MLB123456789',
            preco: 3999.9,
            apiOficial: true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await service.consultarProduto({
      itemId: 'MLB123456789',
      permitirFallback: true,
    });

    expect(result.item?.itemId).toBe('MLB123456789');
    expect(postProdutoIaMock).toHaveBeenCalledWith(
      'https://produto-ia.example.com/mercadolivre/agente/produto',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'chave-interna' }),
      }),
    );
  });

  it('sincroniza preço promocional e grava histórico quando o preço muda', async () => {
    prisma.oferta.findUnique.mockResolvedValue({
      id: 42,
      preco: 4500,
      precoAnterior: null,
      frete: null,
      status: 'ATIVA',
      codigoMarketplace: 'MLB123456789',
      urlOriginal: 'https://produto.mercadolivre.com.br/MLB-123456789-produto',
      urlAfiliada: 'https://mercadolivre.com/sec/abc',
      vendedorNome: null,
      vendedorIdentificador: null,
      produto: { id: 7, nome: 'RTX 5070' },
      parceiro: {
        id: 1,
        nome: 'Mercado Livre',
        slug: 'mercado-livre',
        dominio: 'mercadolivre.com.br',
      },
    });
    tx.oferta.update.mockResolvedValue({
      id: 42,
      preco: 3999.9,
      status: 'ATIVA',
      produto: { id: 7, nome: 'RTX 5070', slug: 'rtx-5070' },
      parceiro: { id: 1, nome: 'Mercado Livre', slug: 'mercado-livre' },
    });
    postProdutoIaMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          item: {
            fonte: 'MERCADO_LIVRE_API',
            apiOficial: true,
            fallbackUsado: false,
            itemId: 'MLB123456789',
            preco: 3999.9,
            precoAnterior: 4499.9,
            descontoPercentual: 11.11,
            disponivel: true,
            vendedorId: 123,
            urlFinal: 'https://produto.mercadolivre.com.br/MLB-123456789-produto',
            origemPreco: 'SALE_PRICE',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await service.sincronizarOferta(42);

    expect(result.mudouPreco).toBe(true);
    expect(result.precoAtual).toBe(3999.9);
    expect(result.precoAnteriorOficial).toBe(4499.9);
    expect(tx.oferta.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: expect.objectContaining({
          preco: 3999.9,
          precoAnterior: 4499.9,
          codigoMarketplace: 'MLB123456789',
          vendedorIdentificador: '123',
          status: 'ATIVA',
        }),
      }),
    );
    expect(tx.historicoPrecoOferta.create).toHaveBeenCalled();
  });
});
