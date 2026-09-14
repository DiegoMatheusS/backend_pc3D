import { OfertasService } from './ofertas.service';
import { PrismaService } from '../prisma/prisma.service';
import { VerificadorPrecosOfertasService } from './verificador-precos-ofertas.service';

describe('integração de verificação individual de ofertas', () => {
  function setup(origemPreco = 'JSON_LD') {
    const offer = {
      id: 42,
      preco: 100,
      precoAnterior: null,
      urlOriginal: 'https://loja.com/item',
      urlAfiliada: null,
      codigoMarketplace: null,
      produto: {
        id: 7,
        nome: 'GPU',
        marca: null,
        modelo: null,
        mpn: null,
        gtin: null,
      },
      parceiro: { id: 1, nome: 'Loja' },
    };

    const prisma = {
      oferta: {
        findMany: jest.fn().mockResolvedValue([offer]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({}),
      },
      historicoPrecoOferta: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );

    const checker = {
      verificarOferta: jest.fn().mockResolvedValue({
        status: 'SUCESSO',
        preco: 90,
        origemPreco,
        urlFinal: offer.urlOriginal,
        urlConsultada: 'ORIGINAL',
      }),
      confirmarComProdutoIa: jest
        .fn()
        .mockResolvedValue({ status: 'ERRO', motivo: 'Sem confirmação' }),
    };

    const service = new OfertasService(
      prisma as unknown as PrismaService,
      checker as unknown as VerificadorPrecosOfertasService,
    );

    return { service, prisma, checker };
  }

  it('filtra pelo id pedido e grava preço e histórico na mesma transação', async () => {
    const { service, prisma } = setup();
    const result = await service.verificarPrecoOferta(42);

    expect(prisma.oferta.findMany.mock.calls).toMatchObject([
      [{ where: { id: 42 }, take: 1 }],
    ]);

    expect(result.ofertaId).toBe(42);
    expect(result.status).toBe('ATUALIZADO');
    expect(prisma.historicoPrecoOferta.create).toHaveBeenCalledTimes(1);

    expect(prisma.oferta.update.mock.calls).toMatchObject([
      [{ data: { preco: 90, precoAnterior: 100 } }],
    ]);
  });

  it('preserva preço heurístico mesmo com variação pequena quando não confirmado', async () => {
    const { service, prisma, checker } = setup('HTML_MARKETPLACE');
    const result = await service.verificarPrecoOferta(42);

    expect(checker.confirmarComProdutoIa).toHaveBeenCalled();
    expect(result.status).toBe('REVISAR');
    expect(prisma.historicoPrecoOferta.create).not.toHaveBeenCalled();

    const chamadas = prisma.oferta.update.mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0][0].data.preco).toBeUndefined();
  });

  it('não reativa uma oferta que a segunda coleta confirmou esgotada', async () => {
    const { service, prisma, checker } = setup('HTML_MARKETPLACE');

    checker.confirmarComProdutoIa.mockResolvedValue({
      status: 'SUCESSO',
      preco: 90,
      disponivel: false,
      identidade: {
        mpn: null,
        gtin: null,
        marca: null,
        modelo: null,
      },
    });

    const result = await service.verificarPrecoOferta(42);

    expect(result.status).toBe('INDISPONIVEL');
    expect(prisma.historicoPrecoOferta.create).not.toHaveBeenCalled();
  });
});
