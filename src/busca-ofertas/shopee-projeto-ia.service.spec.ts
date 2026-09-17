import { postProdutoIa } from '../ia/produto-ia-http';
import { ShopeeProjetoIaService } from './shopee-projeto-ia.service';

jest.mock('../ia/produto-ia-http', () => ({
  postProdutoIa: jest.fn(),
}));

const postProdutoIaMock = postProdutoIa as jest.MockedFunction<typeof postProdutoIa>;

describe('ShopeeProjetoIaService', () => {
  const prisma = {
    oferta: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: ShopeeProjetoIaService;

  beforeEach(() => {
    process.env.PRODUTO_IA_URL = 'https://produto-ia.example.com';
    process.env.PRODUTO_IA_API_KEY = 'chave-interna';
    service = new ShopeeProjetoIaService(prisma as never);
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.PRODUTO_IA_URL;
    delete process.env.PRODUTO_IA_API_KEY;
  });

  it('consulta produtos Shopee pelo ProjetoIA sem credencial Shopee no backend', async () => {
    postProdutoIaMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          fontePrimaria: 'SHOPEE_AFFILIATE_API',
          itens: [{ itemId: '123', nome: 'RTX 5070', preco: 3999.9 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await service.buscarProdutos({ consulta: 'RTX 5070', limite: 10 });

    expect(result.itens?.[0]?.itemId).toBe('123');
    expect(postProdutoIaMock).toHaveBeenCalledWith(
      'https://produto-ia.example.com/shopee/agente/produtos',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'chave-interna' }),
      }),
    );
  });

  it('sincroniza o preço pelo itemId e mantém histórico', async () => {
    prisma.oferta.findUnique.mockResolvedValue({
      id: 42,
      preco: 4500,
      precoAnterior: null,
      frete: null,
      codigoMarketplace: '987654321',
      urlOriginal: 'https://shopee.com.br/produto-i.123456.987654321',
      urlAfiliada: null,
      vendedorNome: null,
      vendedorIdentificador: null,
      produto: { id: 7, nome: 'RTX 5070' },
      parceiro: {
        id: 1,
        nome: 'Shopee',
        slug: 'shopee',
        dominio: 'shopee.com.br',
      },
    });
    prisma.oferta.update.mockResolvedValue({ id: 42, preco: 3999.9 });
    postProdutoIaMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          itens: [
            {
              itemId: '987654321',
              shopId: '123456',
              loja: 'Loja oficial',
              preco: 3999.9,
              urlOriginal: 'https://shopee.com.br/produto-i.123456.987654321',
              urlAfiliada: 'https://s.shopee.com.br/abc',
              emPromocao: true,
              descontoPercentual: 11,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await service.sincronizarOferta(42);

    expect(result.mudouPreco).toBe(true);
    expect(result.precoAtual).toBe(3999.9);
    expect(prisma.oferta.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: expect.objectContaining({
          preco: 3999.9,
          precoAnterior: 4500,
          codigoMarketplace: '987654321',
          urlAfiliada: 'https://s.shopee.com.br/abc',
          historicoPrecos: expect.objectContaining({ create: expect.any(Object) }),
        }),
      }),
    );
  });
});
