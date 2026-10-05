import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PapelGuard } from '../auth/papel.guard';
import { PAPEIS_KEY } from '../auth/papeis.decorator';
import { PapelUsuario } from '../generated/prisma/enums';
import { ProdutoImagemAdminController } from './produto-imagem.controller';

describe('imagem de Produtos no Admin', () => {
  const imagem = { imagemUrl: 'https://cdn.test/foto.jpg', fonte: 'Magazine Luiza', urlFonte: 'https://magazineluiza.com.br/produto' };
  const produto = { id: 42, hardwareId: 17, nome: 'Zotac RTX 4060', modelo: 'RTX 4060' };
  const imagens = { buscar: jest.fn() };
  const produtos = { buscarAdmin: jest.fn() };
  const prisma = { produto: { update: jest.fn() } };
  const auditoria = { registrar: jest.fn() };
  const controller = new ProdutoImagemAdminController(imagens as never, produtos as never, auditoria as never, prisma as never);

  beforeEach(() => {
    imagens.buscar.mockResolvedValue(imagem);
    produtos.buscarAdmin.mockResolvedValue(produto);
    prisma.produto.update.mockResolvedValue({ ...produto, imagemUrl: imagem.imagemUrl });
    auditoria.registrar.mockResolvedValue(undefined);
  });
  afterEach(() => jest.resetAllMocks());

  it('preenche o formulário sem gravar nenhum cadastro', async () => {
    await expect(controller.buscar({ nome: produto.nome, modelo: produto.modelo })).resolves.toEqual(imagem);
    expect(produtos.buscarAdmin).not.toHaveBeenCalled();
    expect(prisma.produto.update).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('salva apenas a URL da imagem no Produto correto e registra a origem', async () => {
    const result = await controller.buscarESalvar(42, { id: 5 }, { ip: '127.0.0.1' } as Request);
    expect(prisma.produto.update).toHaveBeenCalledWith({ where: { id: 42 }, data: { imagemUrl: imagem.imagemUrl } });
    expect(prisma.produto.update).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ produtoId: 42, imagemUrl: imagem.imagemUrl, status: 'IMAGEM_ATUALIZADA' });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ entidade: 'Produto', entidadeId: 42, dadosNovos: expect.objectContaining({ urlFonte: imagem.urlFonte }) }));
  });

  it('mantém os dados quando a busca falha', async () => {
    imagens.buscar.mockRejectedValue(new Error('Imagem não encontrada'));
    await expect(controller.buscarESalvar(42, null, {} as Request)).rejects.toThrow('Imagem não encontrada');
    expect(prisma.produto.update).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('atualiza somente a imagem comercial também em Notebooks e PCs Montados', async () => {
    for (const tipo of ['NOTEBOOK', 'PC_MONTADO']) {
      produtos.buscarAdmin.mockResolvedValue({ ...produto, tipo });
      await controller.buscarESalvar(42, null, {} as Request);
      expect(prisma.produto.update).toHaveBeenLastCalledWith({ where: { id: 42 }, data: { imagemUrl: imagem.imagemUrl } });
    }
  });

  it('exige autenticação e restringe a busca a Admin e Editor', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ProdutoImagemAdminController)).toEqual([AuthGuard, PapelGuard]);
    expect(Reflect.getMetadata(PAPEIS_KEY, ProdutoImagemAdminController)).toEqual([PapelUsuario.ADMIN, PapelUsuario.EDITOR]);
  });
});
