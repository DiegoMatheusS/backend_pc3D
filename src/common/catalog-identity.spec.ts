import {
  assertCatalogIdentityAvailable,
  sameCatalogIdentity,
  possibleCatalogIdentity,
} from './catalog-identity';
import { Prisma } from '../generated/prisma/client';

describe('identidade do catálogo', () => {
  it('reconhece nomes sem acentos, espaços, hífens ou diferenças de caixa', () => {
    expect(
      sameCatalogIdentity(
        { nome: 'Placa de Vídeo ZOTAC RTX-4060' },
        { nome: 'placa de video zotac rtx 4060' },
      ),
    ).toBe(true);
  });
  it('identifica pelo GTIN normalizado ou MPN com fabricante', () => {
    expect(
      sameCatalogIdentity(
        { gtin: '789-1234567890' },
        { gtin: '7891234567890' },
      ),
    ).toBe(true);
    expect(
      sameCatalogIdentity(
        { marca: 'Zotac', mpn: 'ZT-D40600E-10M' },
        { marca: 'ZOTAC', mpn: 'zt d40600e 10m' },
      ),
    ).toBe(true);
    expect(
      sameCatalogIdentity(
        { marca: 'Asus', mpn: 'ABC123' },
        { marca: 'Zotac', mpn: 'ABC123' },
      ),
    ).toBe(false);
  });
  it('reconhece marca e modelo normalizados sem depender do título do anúncio', () => {
    expect(
      sameCatalogIdentity(
        { nome: 'Anúncio de mouse', marca: 'Logitech', modelo: 'G-502' },
        { nome: 'Mouse Gamer Hero', marca: 'LOGITECH', modelo: 'G502' },
      ),
    ).toBe(true);
  });
  it('preserva variantes com identificadores, capacidades ou modelos diferentes', () => {
    const item = {
      nome: 'Notebook 16GB',
      marca: 'Lenovo',
      modelo: 'IdeaPad',
      mpn: 'VARIANTE16',
    };
    expect(sameCatalogIdentity(item, { ...item, mpn: 'VARIANTE8' })).toBe(
      false,
    );
    expect(
      sameCatalogIdentity(item, {
        ...item,
        nome: 'Notebook 8GB',
        mpn: undefined,
      }),
    ).toBe(false);
    expect(
      sameCatalogIdentity(
        { marca: 'Zotac', modelo: 'RTX 4060' },
        { marca: 'Zotac', modelo: 'RTX 4060 Ti' },
      ),
    ).toBe(false);
    expect(sameCatalogIdentity({}, {})).toBe(false);
  });

  it('título incompleto da Zotac exige confirmar a ficha antes de criar outra', () => {
    const item = {
      nome: 'Zotac Gaming RTX 4060 Twin Edge 8GB',
      marca: 'Zotac',
      modelo: 'ZT-D40600E-10M',
      mpn: 'ZT-D40600E-10M',
    };
    expect(
      possibleCatalogIdentity(
        {
          nome: 'Placa De Vídeo Zotac Rtx 4060',
          marca: 'Zotac',
          modelo: 'RTX 4060',
        },
        item,
      ),
    ).toBe(true);
    expect(
      possibleCatalogIdentity(
        {
          nome: 'Placa Zotac RTX 4060 Ti',
          marca: 'Zotac',
          modelo: 'RTX 4060 Ti',
        },
        item,
      ),
    ).toBe(false);
    expect(
      possibleCatalogIdentity(
        {
          nome: 'Placa Zotac RTX 4060',
          marca: 'Zotac',
          modelo: 'ZT-D40600E-OUTRA',
          mpn: 'ZT-D40600E-OUTRA',
        },
        item,
      ),
    ).toBe(false);
  });

  function transaction(products = [], hardwares = []) {
    return {
      $executeRaw: jest.fn().mockResolvedValue(1),
      produto: { findMany: jest.fn().mockResolvedValue(products) },
      hardware: { findMany: jest.fn().mockResolvedValue(hardwares) },
    };
  }

  it('protege todos os tipos, inclusive registros inativos, sob o mesmo lock', async () => {
    for (const tipo of ['GENERICO', 'NOTEBOOK', 'BUILD', 'HARDWARE']) {
      const tx = transaction([
        { id: 42, tipo, ativo: false, nome: 'Produto 123' },
      ] as never);
      await expect(
        assertCatalogIdentityAvailable(
          tx as unknown as Prisma.TransactionClient,
          { nome: 'produto-123' },
        ),
      ).rejects.toMatchObject({ response: { produtoExistenteId: 42 } });
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.produto.findMany.mock.invocationCallOrder[0],
      );
    }
  });
  it('Hardware existente impede nova ficha, mas permite seu primeiro Produto comercial', async () => {
    const hardware = { id: 8, nome: 'Zotac RTX 4060' };
    const tx = transaction([], [hardware] as never);
    await expect(
      assertCatalogIdentityAvailable(
        tx as unknown as Prisma.TransactionClient,
        hardware,
      ),
    ).rejects.toMatchObject({ response: { hardwareExistenteId: 8 } });
    await expect(
      assertCatalogIdentityAvailable(
        tx as unknown as Prisma.TransactionClient,
        hardware,
        { hardwareOriginId: 8 },
      ),
    ).resolves.toBeUndefined();
  });
  it('a origem técnica não permite criar outro Produto que já exista', async () => {
    const identity = { id: 8, nome: 'Zotac RTX 4060' };
    const tx = transaction(
      [{ ...identity, id: 42 }] as never,
      [identity] as never,
    );
    await expect(
      assertCatalogIdentityAvailable(
        tx as unknown as Prisma.TransactionClient,
        identity,
        { hardwareOriginId: 8 },
      ),
    ).rejects.toMatchObject({ response: { produtoExistenteId: 42 } });
  });
});

describe('identidade de PC montado separada dos componentes', () => {
  const cpu = {
    id: 180,
    tipo: 'HARDWARE',
    nome: 'Ryzen 5 5500',
    marca: 'AMD',
    modelo: 'Ryzen 5 5500',
  };
  const pc = {
    nome: 'PC Gamer AMD Ryzen 5 5500',
    marca: 'AMD',
    modelo: 'Ryzen 5 5500',
  };
  function txWith(products: Array<typeof cpu>) {
    return {
      $executeRaw: jest.fn().mockResolvedValue(1),
      produto: {
        findMany: jest
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve(
              products.filter((p) => !where?.tipo || p.tipo === where.tipo),
            ),
          ),
      },
      hardware: { findMany: jest.fn().mockResolvedValue([cpu]) },
    };
  }
  it('permite cadastrar PC que usa o Produto 180 como componente', async () => {
    const tx = txWith([cpu]);
    await expect(
      assertCatalogIdentityAvailable(
        tx as unknown as Prisma.TransactionClient,
        pc,
        { tipoProduto: 'BUILD' },
      ),
    ).resolves.toBeUndefined();
    expect(tx.produto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo: 'BUILD' } }),
    );
    expect(tx.hardware.findMany).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalled();
  });
  it('continua rejeitando duplicação de outro PC montado', async () => {
    const tx = txWith([{ ...cpu, ...pc, tipo: 'BUILD', id: 200 }]);
    await expect(
      assertCatalogIdentityAvailable(
        tx as unknown as Prisma.TransactionClient,
        pc,
        { tipoProduto: 'BUILD' },
      ),
    ).rejects.toMatchObject({ response: { produtoExistenteId: 200 } });
  });
});
