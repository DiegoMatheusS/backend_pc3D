import { NotFoundException } from '@nestjs/common';
import { NotebooksService } from './notebooks.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Consulta pública de notebooks', () => {
  const prisma = {
    notebook: { findFirst: jest.fn(), findUnique: jest.fn() },
    avaliacao: { aggregate: jest.fn() },
  };
  const service = new NotebooksService(prisma as unknown as PrismaService);
  beforeEach(() => jest.resetAllMocks());

  it('resolve o slug somente entre produtos ativos e publicados', async () => {
    prisma.notebook.findFirst.mockResolvedValue({ id: 5 });
    prisma.notebook.findUnique.mockResolvedValue({
      id: 5, produtoId: 10, produto: { ativo: true, publicado: true }, especificacao: { webcam: null },
    });
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { nota: 4 }, _count: { _all: 2 } });
    const result = await service.buscarPublicoPorSlug('acer-aspire-5');
    expect(prisma.notebook.findFirst).toHaveBeenCalledWith({
      where: { produto: { slug: 'acer-aspire-5', ativo: true, publicado: true } },
      select: { id: true },
    });
    expect(result.especificacao.webcam).toBeNull();
    expect(result.id).toBe(5);
  });

  it.each([{ ativo: false, publicado: true }, { ativo: true, publicado: false }])(
    'não expõe notebook inativo ou rascunho por ID (%j)',
    async (produto) => {
      prisma.notebook.findUnique.mockResolvedValue({ id: 5, produtoId: 10, produto });
      await expect(service.buscarPublico(5)).rejects.toThrow(NotFoundException);
      expect(prisma.avaliacao.aggregate).not.toHaveBeenCalled();
    },
  );

  it('retorna 404 para slug não publicado ou inexistente', async () => {
    prisma.notebook.findFirst.mockResolvedValue(null);
    await expect(service.buscarPublicoPorSlug('rascunho')).rejects.toThrow(NotFoundException);
    expect(prisma.notebook.findUnique).not.toHaveBeenCalled();
  });
});
