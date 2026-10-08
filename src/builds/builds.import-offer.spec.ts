import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BuildsCatalogoService } from './builds-catalogo.service';
import { CriarBuildDto } from './dtos/criar-build.dto';
import { CategoriaHardware } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';

describe('cadastro de PC com oferta', () => {
  const body = {
    nome: 'PC Gamer teste',
    publicado: false,
    componentes: [{ hardwareId: 1, categoria: CategoriaHardware.PROCESSADOR }],
    oferta: {
      parceiroId: 2,
      preco: 3999.9,
      urlOriginal: 'https://www.magazineluiza.com.br/pc/p/123/',
      urlAfiliada: 'https://www.magazinevoce.com.br/loja/pc/',
    },
  };
  function setup() {
    const prisma = {
      parceiro: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
      build: { create: jest.fn().mockResolvedValue({ id: 1 }) },
      produto: { findMany: jest.fn().mockResolvedValue([]) },
      hardware: { findMany: jest.fn().mockResolvedValue([]) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(prisma as unknown as Prisma.TransactionClient),
    );
    const service = new BuildsCatalogoService(
      prisma as never,
      { buscarAdmin: jest.fn().mockResolvedValue({ id: 1 }) } as never,
    );
    const internals = service as unknown as {
      validarVinculos(): Promise<void>;
      categoriaComercial(): Promise<{ id: number }>;
      slugUnico(): Promise<string>;
    };
    jest.spyOn(internals, 'validarVinculos').mockResolvedValue(undefined);
    jest.spyOn(internals, 'categoriaComercial').mockResolvedValue({ id: 1 });
    jest.spyOn(internals, 'slugUnico').mockResolvedValue('pc-gamer-teste');
    return { prisma, service };
  }
  it('grava PC e oferta na mesma criação aninhada', async () => {
    const { prisma, service } = setup();
    await service.criar(body);
    const calls = prisma.build.create.mock.calls as [Prisma.BuildCreateArgs][];
    const create = calls[0][0];
    expect(create.data.produto?.create).toMatchObject({
      ofertas: { create: body.oferta },
    });
    expect(prisma.produto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo: 'BUILD' } }),
    );
    expect(prisma.hardware.findMany).not.toHaveBeenCalled();
  });
  it('não cria o PC quando a loja é inativa ou inexistente', async () => {
    const { prisma, service } = setup();
    prisma.parceiro.findFirst.mockResolvedValue(null);
    await expect(service.criar(body)).rejects.toThrow('loja ativa');
    expect(prisma.build.create).not.toHaveBeenCalled();
  });
  it('recusa PC já cadastrado antes de criar Produto, Build ou oferta', async () => {
    const { prisma, service } = setup();
    prisma.produto.findMany.mockResolvedValue([
      { id: 42, nome: 'PC gamer teste' },
    ] as never);
    await expect(service.criar(body)).rejects.toThrow('Já existe o Produto 42');
    expect(prisma.build.create).not.toHaveBeenCalled();
  });
  it('valida preço e URL dentro da oferta', () => {
    expect(validateSync(plainToInstance(CriarBuildDto, body))).toHaveLength(0);
    const invalid = plainToInstance(CriarBuildDto, {
      ...body,
      oferta: { ...body.oferta, preco: -1, urlOriginal: 'javascript:alert(1)' },
    });
    expect(
      validateSync(invalid).some((error) => error.property === 'oferta'),
    ).toBe(true);
  });
});

describe('contrato de anúncio comercial com vínculos opcionais', () => {
  it('aceita descrição longa sem o antigo corte em 4000 caracteres', () => {
    const dto = plainToInstance(CriarBuildDto, {
      nome: 'PC Gamer',
      descricao: 'Configuração, acessórios e garantia.\n'.repeat(400),
    });
    expect(validateSync(dto)).toHaveLength(0);
  });
  it('aceita PC/kit com descrição e sem lista de hardwares', () => {
    const dto = plainToInstance(CriarBuildDto, {
      nome: 'Kit upgrade',
      categoria: 'KIT_UPGRADE',
      publicado: true,
      descricao: 'Placa-mãe e memória 16 GB; marca da RAM não informada.',
    });
    expect(validateSync(dto)).toHaveLength(0);
  });
});
