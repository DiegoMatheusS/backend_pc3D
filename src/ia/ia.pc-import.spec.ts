import 'reflect-metadata';
import { IaService } from './ia.service';
import { CategoriaHardware } from '../generated/prisma/enums';

jest.mock('../common/security/external-http-security', () => ({
  validarUrlPublica: jest.fn().mockResolvedValue(undefined),
}));

describe('importação de PC pelo ProjetoIA', () => {
  function setup(matches: object[]) {
    const prisma = {
      hardware: {
        findMany: jest
          .fn<Promise<object[]>, [{ where: { publicado: boolean } }]>()
          .mockResolvedValue(matches),
      },
    };
    const python = {
      importarUrl: jest.fn().mockResolvedValue({
        categoriaDetectada: 'PC_MONTADO',
        payloadParcialBackend: { nome: 'PC Gamer' },
        especificacoesEncontradas: {
          componentes: [
            { categoria: 'PROCESSADOR', nome: 'Ryzen 5 5600', quantidade: 1 },
          ],
        },
        ofertaColetada: { preco: 3999.9 },
      }),
    };
    return {
      prisma,
      python,
      service: new IaService(
        prisma as never,
        {} as never,
        python as never,
        {} as never,
      ),
    };
  }
  it('transporta peças detectadas até a prévia e conserva o preço', async () => {
    const { service, prisma, python } = setup([
      { id: 7, nome: 'Ryzen 5 5600', categoria: CategoriaHardware.PROCESSADOR },
    ]);
    const result = await service.importarLinkAdmin({
      url: 'https://www.magazineluiza.com.br/pc/p/123/',
      categoriaEsperada: 'PC_MONTADO',
    });
    expect(result.cadastroSugerido?.payload.componentes).toEqual([
      { hardwareId: 7, categoria: 'PROCESSADOR', quantidade: 1 },
    ]);
    expect(result.ofertaColetada.preco).toBe(3999.9);
    expect(python.importarUrl).toHaveBeenCalledWith(
      'https://www.magazineluiza.com.br/pc/p/123/',
      'PC_MONTADO',
      { detalharPagina: true },
    );
    const query: unknown = prisma.hardware.findMany.mock.calls[0]?.[0];
    expect(query).toMatchObject({ where: { publicado: true } });
  });
  it('deixa alternativas ambíguas para escolha do administrador', async () => {
    const { service } = setup([{ id: 7 }, { id: 8 }]);
    const result = await service.importarLinkAdmin({
      url: 'https://www.magazineluiza.com.br/pc/p/123/',
      categoriaEsperada: 'PC_MONTADO',
    });
    expect(result.cadastroSugerido?.payload.componentes).toEqual([]);
    expect(
      result.cadastroSugerido?.componentesDetectados?.[0].hardwareId,
    ).toBeNull();
  });
});
