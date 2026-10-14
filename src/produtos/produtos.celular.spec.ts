import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutoOfertaExtensaoDto } from '../produto-ia-integracao-interna/dtos/importar-oferta-extensao-produto-ia.dto';
import { CriarProdutoDto } from './dtos/criar-produto.dto';
import { ProdutosService } from './produtos.service';

describe('Ficha de celulares', () => {
  it('aceita a mesma ficha no cadastro por link e pela extensão, inclusive NFC false', async () => {
    const especificacaoCelular = { ramGb: 8, bateriaMah: 5000, nfc: false };
    const options = { whitelist: true, forbidNonWhitelisted: true };
    expect(
      await validate(
        plainToInstance(CriarProdutoDto, {
          categoriaId: 3,
          nome: 'Galaxy S24',
          especificacaoCelular,
        }),
        options,
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(ProdutoOfertaExtensaoDto, {
          categoriaSlug: 'celulares',
          nome: 'Galaxy S24',
          especificacaoCelular,
        }),
        options,
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(CriarProdutoDto, {
          categoriaId: 3,
          nome: 'Galaxy S24',
          especificacaoCelular: { nfc: 'Não' },
        }),
        options,
      ),
    ).not.toEqual([]);
  });

  it('salva em metadados sem perder dados anteriores e expõe a ficha pública', async () => {
    const item = {
      id: 7,
      tipo: 'GENERICO',
      nome: 'Galaxy S24',
      marca: 'Samsung',
      modelo: 'S24',
      publicado: true,
      ativo: true,
      categoria: { id: 3, slug: 'celulares', ativo: true },
      metadados: { asin: 'ORIGINAL', especificacoesEncontradas: { ramGb: 8 } },
      especificacaoMonitor: null,
      especificacaoMouse: null,
      especificacaoTeclado: null,
      especificacaoHeadset: null,
      hardware: null,
      notebook: null,
      build: null,
      ofertas: [],
    };
    const prisma = {
      produto: {
        findUnique: jest.fn().mockResolvedValue(item),
        update: jest.fn().mockResolvedValue(item),
      },
      avaliacao: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _avg: { nota: null }, _count: { _all: 0 } }),
      },
    };
    const service = new ProdutosService(prisma as unknown as PrismaService);
    await service.atualizar(7, {
      especificacaoCelular: { bateriaMah: 5000, nfc: false },
    });
    const calls = prisma.produto.update.mock.calls as unknown as [{ data: { metadados: Record<string, unknown> } }][];
    const write = calls[0][0];
    expect(write.data.metadados).toEqual({
      asin: 'ORIGINAL',
      especificacoesEncontradas: { ramGb: 8 },
      especificacoes: { ramGb: 8, bateriaMah: 5000, nfc: false },
    });
    prisma.produto.findUnique.mockResolvedValue({
      ...item,
      metadados: write.data.metadados,
    });
    const publico = await service.buscarPublicoPorId(7);
    expect(publico.especificacoes).toEqual({
      ramGb: 8,
      bateriaMah: 5000,
      nfc: false,
    });
  });
});
