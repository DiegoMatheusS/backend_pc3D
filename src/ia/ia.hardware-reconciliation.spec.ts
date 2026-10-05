import 'reflect-metadata';
import { IaService } from './ia.service';

jest.mock('../common/security/external-http-security', () => ({
  validarUrlPublica: jest.fn().mockResolvedValue(undefined),
}));

describe('importação de oferta com Hardware existente', () => {
  const hardware = { id: 42, produtoId: null };
  const dados = {
    url: 'https://shopee.com.br/product/10/20',
    categoriaEsperada: 'PROCESSADOR' as const,
  };

  function setup(payload: Record<string, unknown>) {
    const prisma = {
      hardware: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      produto: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      oferta: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    const python = {
      importarUrl: jest.fn().mockResolvedValue({
        categoriaDetectada: 'PROCESSADOR',
        payloadParcialBackend: { nome: 'Processador Ryzen 5 5600', ...payload },
        ofertaColetada: { preco: 799.9, urlOriginal: dados.url },
      }),
    };
    return {
      prisma,
      service: new IaService(
        prisma as never,
        {} as never,
        python as never,
        {} as never,
      ),
    };
  }

  it('encontra Hardware sem Produto pelo GTIN e preserva a oferta para revisão', async () => {
    const { service, prisma } = setup({ gtin: '7891234567895' });
    prisma.hardware.findFirst.mockResolvedValue(hardware);
    const result = await service.importarLinkAdmin(dados);
    expect(result.reconciliacao.hardwareExistente).toEqual(hardware);
    expect(result.reconciliacao.criterioHardware).toBe('GTIN');
    expect(result.reconciliacao.produtoExistente).toBeNull();
    expect(result.ofertaColetada.preco).toBe(799.9);
    expect(prisma.hardware.findFirst).toHaveBeenCalledWith({
      where: { categoria: 'PROCESSADOR', gtin: '7891234567895' },
      select: { id: true, produtoId: true },
    });
    expect(prisma.hardware.create).not.toHaveBeenCalled();
    expect(prisma.produto.create).not.toHaveBeenCalled();
    expect(prisma.oferta.create).not.toHaveBeenCalled();
  });

  it('reutiliza também o Produto vinculado ao Hardware identificado por MPN e marca', async () => {
    const { service, prisma } = setup({
      mpn: '100-100000927BOX',
      marca: 'AMD',
    });
    prisma.hardware.findFirst.mockResolvedValue({ id: 42, produtoId: 91 });
    prisma.produto.findUnique.mockResolvedValue({
      id: 91,
      hardware: { id: 42 },
    });
    const result = await service.importarLinkAdmin(dados);
    expect(result.reconciliacao.produtoExistente).toEqual({
      id: 91,
      hardwareId: 42,
    });
    expect(result.reconciliacao.criterioProduto).toBe('MPN_MARCA');
    expect(prisma.produto.findUnique).toHaveBeenCalledWith({
      where: { id: 91 },
      include: { hardware: true },
    });
    expect(prisma.oferta.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { produtoId: 91, urlOriginal: dados.url },
      }),
    );
  });

  it('encontra Hardware por marca e modelo sem depender de publicação ou Produto', async () => {
    const { service, prisma } = setup({ marca: 'AMD', modelo: 'Ryzen 5 5600' });
    prisma.hardware.findMany.mockResolvedValue([hardware]);
    const result = await service.importarLinkAdmin(dados);
    expect(result.reconciliacao.hardwareExistente).toEqual(hardware);
    expect(result.reconciliacao.criterioHardware).toBe('MARCA_MODELO');
    expect(prisma.hardware.findMany).toHaveBeenCalledWith({
      where: {
        categoria: 'PROCESSADOR',
        marca: { equals: 'AMD', mode: 'insensitive' },
        modelo: { equals: 'Ryzen 5 5600', mode: 'insensitive' },
      },
      select: { id: true, produtoId: true },
      take: 2,
    });
  });

  it('mantém candidatos ambíguos para revisão sem selecionar o primeiro', async () => {
    const { service, prisma } = setup({ marca: 'AMD', modelo: 'Ryzen 5 5600' });
    const candidates = [hardware, { id: 43, produtoId: null }];
    prisma.hardware.findMany.mockResolvedValue(candidates);
    const result = await service.importarLinkAdmin(dados);
    expect(result.reconciliacao.hardwareExistente).toBeNull();
    expect(result.reconciliacao.hardwaresAmbiguos).toEqual(candidates);
  });

  it('não considera título parecido uma confirmação de identidade', async () => {
    const { service, prisma } = setup({});
    const result = await service.importarLinkAdmin(dados);
    expect(result.reconciliacao.hardwareExistente).toBeNull();
    expect(prisma.hardware.findFirst).not.toHaveBeenCalled();
    expect(prisma.hardware.findMany).not.toHaveBeenCalled();
  });
});
