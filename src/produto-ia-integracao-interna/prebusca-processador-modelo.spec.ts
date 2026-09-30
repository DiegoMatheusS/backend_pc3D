import { ConflictException } from '@nestjs/common';
import { HardwaresService } from '../hardwares/hardwares.service';
import { ProdutosService } from '../produtos/produtos.service';
import { ProdutoIaIntegracaoInternaController } from './produto-ia-integracao-interna.controller';
import { ProdutoIaIntegracaoInternaService } from './produto-ia-integracao-interna.service';
import { assinaturaCpu, buscarCpuPorTitulo } from './prebusca-processador-modelo';

describe('Pré-busca de processador em produtos e hardwares de outras lojas', () => {
  const tituloAmazon = 'AMD Ryzen 7 5700 8 núcleos 16 Thread soquete AM4 Wraith Stealth';

  it('identifica o modelo completo sem confundir variantes', () => {
    expect(assinaturaCpu(tituloAmazon)).toBe('amd:ryzen:7:5700:');
    expect(assinaturaCpu('Ryzen 7 5700X')).toBe('amd:ryzen:7:5700:x');
    expect(assinaturaCpu('Ryzen 7 5700G')).toBe('amd:ryzen:7:5700:g');
    expect(assinaturaCpu('Computador AMD Ryzen 7 5700 16 GB RAM')).toBeNull();
  });

  it('busca por nome quando o modelo salvo é o MPN da caixa', () => {
    const itens = buscarCpuPorTitulo(tituloAmazon, [{
      id: 61,
      nome: 'Processador AMD Ryzen 7 5700 AM4',
      modelo: '100-100000743BOX',
      marca: 'AMD',
      categoria: { slug: 'processadores' },
    }], []);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toEqual(expect.objectContaining({ tipo: 'PRODUTO', id: 61 }));
  });

  it('nunca associa Ryzen 7 5700 ao 5700X nem a um PC', () => {
    const produtos = [{
      id: 71,
      nome: 'Processador AMD Ryzen 7 5700X',
      modelo: 'Ryzen 7 5700X',
      marca: 'AMD',
      categoria: { slug: 'processadores' },
    }];
    expect(buscarCpuPorTitulo(tituloAmazon, produtos, [])).toEqual([]);
    expect(buscarCpuPorTitulo('Computador AMD Ryzen 7 5700 16 GB RAM', produtos, [])).toEqual([]);
  });

  it('deduplica Hardware e seu Produto comercial vinculado', () => {
    const itens = buscarCpuPorTitulo(tituloAmazon, [{
      id: 61,
      nome: 'Processador AMD Ryzen 7 5700',
      modelo: '100-100000743BOX',
      marca: 'AMD',
      categoria: { slug: 'processadores' },
      hardware: { id: 19, categoria: 'PROCESSADOR' },
    }], [{
      id: 19,
      nome: 'AMD Ryzen 7 5700',
      modelo: 'Ryzen 7 5700',
      marca: 'AMD',
      categoria: 'PROCESSADOR',
      produtoId: 61,
    }]);
    expect(itens).toHaveLength(1);
    expect(itens[0].id).toBe(61);
  });

  function setup(produtosNoBanco: object[], hardwaresNoBanco: object[], respostaNormal: object = {status:'NAO_ENCONTRADO'}) {
    const integracao = { buscarItemExtensao: jest.fn().mockResolvedValue(respostaNormal) };
    const produtos = { listarAdmin: jest.fn().mockResolvedValue(produtosNoBanco) };
    const hardwares = { listarTodos: jest.fn().mockResolvedValue(hardwaresNoBanco) };
    const controller = new ProdutoIaIntegracaoInternaController(
      integracao as unknown as ProdutoIaIntegracaoInternaService,
      produtos as unknown as ProdutosService,
      hardwares as unknown as HardwaresService,
    );
    return { controller, integracao, produtos, hardwares };
  }

  let oldKey: string | undefined;
  beforeAll(() => {
    oldKey = process.env.PRODUTO_IA_API_KEY;
    process.env.PRODUTO_IA_API_KEY = 'chave-teste';
  });
  afterAll(() => {
    if (oldKey === undefined) delete process.env.PRODUTO_IA_API_KEY;
    else process.env.PRODUTO_IA_API_KEY = oldKey;
  });

  it('retorna o Produto do CriaByte em vez de seguir para Completar com IA', async () => {
    const { controller } = setup([{
      id: 61,
      nome: 'Processador AMD Ryzen 7 5700',
      marca: 'AMD',
      modelo: '100-100000743BOX',
      categoria: { slug: 'processadores' },
    }], []);
    const encontrado = await controller.buscarItem('chave-teste', {
      nome: tituloAmazon, asin: 'B0FQPCRG7P', marca: 'AMD', modelo: 'Ryzen 7',
    });
    expect(encontrado).toEqual(expect.objectContaining({
      status: 'EXISTENTE', tipo: 'PRODUTO', produtoId: 61,
      criterio: 'MODELO_IDENTIFICADO_NO_TITULO',
    }));
  });

  it('busca também Hardwares sem Produto comercial', async () => {
    const { controller } = setup([], [{
      id: 33, nome: 'AMD Ryzen 7 5700', marca: 'AMD',
      modelo: '100-100000743BOX', categoria: 'PROCESSADOR', produtoId: null,
    }]);
    const encontrado = await controller.buscarItem('chave-teste', { nome: tituloAmazon, asin: 'B0FQPCRG7P' });
    expect(encontrado).toEqual(expect.objectContaining({
      status: 'EXISTENTE', tipo: 'HARDWARE', hardwareId: 33,
    }));
  });

  it('bloqueia associação automática se houver dois cadastros distintos do mesmo modelo', async () => {
    const { controller } = setup([{
      id: 61, nome: 'Processador AMD Ryzen 7 5700', marca: 'AMD',
      categoria: { slug: 'processadores' },
    }, {
      id: 62, nome: 'AMD Ryzen 7 5700 OEM', marca: 'AMD',
      categoria: { slug: 'processadores' },
    }], []);
    await expect(controller.buscarItem('chave-teste', { nome: tituloAmazon }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('ignora resultado fraco que menciona outro processador', async () => {
    const { controller } = setup([], [], {
      status: 'EXISTENTE', tipo: 'HARDWARE', hardwareId: 88,
      criterio: 'MARCA_MODELO',
      item: { nome: 'AMD Ryzen 7 5700X', modelo: 'Ryzen 7' },
    });
    await expect(controller.buscarItem('chave-teste', { nome: tituloAmazon }))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
