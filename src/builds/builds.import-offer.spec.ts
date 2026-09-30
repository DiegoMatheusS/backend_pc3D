import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BuildsCatalogoService } from './builds-catalogo.service';
import { CriarBuildDto } from './dtos/criar-build.dto';
import { CategoriaHardware } from '../generated/prisma/enums';

describe('cadastro de PC com oferta', () => {
  const body = {
    nome: 'PC Gamer teste', publicado: false,
    componentes: [{ hardwareId: 1, categoria: CategoriaHardware.PROCESSADOR }],
    oferta: { parceiroId: 2, preco: 3999.9, urlOriginal: 'https://www.magazineluiza.com.br/pc/p/123/', urlAfiliada: 'https://www.magazinevoce.com.br/loja/pc/' },
  };
  function setup() {
    const prisma = { parceiro: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) }, build: { create: jest.fn().mockResolvedValue({ id: 1 }) } };
    const service = new BuildsCatalogoService(prisma as never, { buscarAdmin: jest.fn().mockResolvedValue({ id: 1 }) } as never);
    jest.spyOn(service as any, 'validarVinculos').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'categoriaComercial').mockResolvedValue({ id: 1 });
    jest.spyOn(service as any, 'slugUnico').mockResolvedValue('pc-gamer-teste');
    return { prisma, service };
  }
  it('grava PC e oferta na mesma criação aninhada', async () => {
    const { prisma, service } = setup();
    await service.criar(body);
    const create = prisma.build.create.mock.calls[0][0];
    expect(create.data.produto.create.ofertas.create).toEqual(expect.objectContaining(body.oferta));
  });
  it('não cria o PC quando a loja é inativa ou inexistente', async () => {
    const { prisma, service } = setup();
    prisma.parceiro.findFirst.mockResolvedValue(null as never);
    await expect(service.criar(body)).rejects.toThrow('loja ativa');
    expect(prisma.build.create).not.toHaveBeenCalled();
  });
  it('valida preço e URL dentro da oferta', () => {
    expect(validateSync(plainToInstance(CriarBuildDto, body))).toHaveLength(0);
    const invalid = plainToInstance(CriarBuildDto, { ...body, oferta: { ...body.oferta, preco: -1, urlOriginal: 'javascript:alert(1)' } });
    expect(validateSync(invalid).some(error => error.property === 'oferta')).toBe(true);
  });
});

describe('contrato de anúncio comercial com vínculos opcionais', () => {
  it('aceita PC/kit com descrição e sem lista de hardwares', () => {
    const dto = plainToInstance(CriarBuildDto, {
      nome: 'Kit upgrade', categoria: 'KIT_UPGRADE', publicado: true,
      descricao: 'Placa-mãe e memória 16 GB; marca da RAM não informada.',
    });
    expect(validateSync(dto)).toHaveLength(0);
  });
});
