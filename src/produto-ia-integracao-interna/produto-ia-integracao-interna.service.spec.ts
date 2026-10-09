import { HardwaresDescobertaIaService } from '../hardwares-descoberta-ia/hardwares-descoberta-ia.service';
import { HardwaresService } from '../hardwares/hardwares.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { ProdutosService } from '../produtos/produtos.service';
import { ImportarOfertaExtensaoProdutoIaDto } from './dtos/importar-oferta-extensao-produto-ia.dto';
import { ProdutoIaIntegracaoInternaService } from './produto-ia-integracao-interna.service';

describe('ProdutoIaIntegracaoInternaService', () => {
  const hardwarePayload = {
    hardwarePayload: {
      nome: 'RTX 5070 Teste',
      categoria: 'PLACA_VIDEO',
      marca: 'ASUS',
      modelo: 'RTX5070-TEST',
    },
    parceiro: {
      nome: 'Shopee',
      dominio: 'shopee.com.br',
      site: 'https://shopee.com.br',
    },
    oferta: {
      urlOriginal: 'https://shopee.com.br/produto/123?utm_source=x',
      urlAfiliada: 'https://s.shopee.com.br/abc',
      preco: 4299.9,
      codigoMarketplace: 'SHOPEE-123',
    },
  } as unknown as ImportarOfertaExtensaoProdutoIaDto;

  const produtoPayload = {
    produtoPayload: {
      categoriaSlug: 'monitores',
      nome: 'Monitor LG UltraGear 24',
      marca: 'LG',
      modelo: '24GN60R-B',
      imagemUrl: 'https://cdn.example/monitor.jpg',
      especificacaoMonitor: {
        tamanhoPolegadas: 24,
        resolucao: '1920x1080',
        taxaAtualizacaoHz: 144,
      },
    },
    parceiro: {
      nome: 'Shopee',
      dominio: 'shopee.com.br',
      site: 'https://shopee.com.br',
    },
    oferta: {
      urlOriginal: 'https://shopee.com.br/monitor/456',
      urlAfiliada: 'https://s.shopee.com.br/monitor456',
      preco: 899.9,
      codigoMarketplace: 'SHOPEE-MONITOR-456',
    },
  } as unknown as ImportarOfertaExtensaoProdutoIaDto;

  function setup(
    ofertasExistentes: Array<Record<string, unknown>> = [],
    produtosExistentes: Array<Record<string, unknown>> = [],
    hardwaresExistentes: Array<Record<string, unknown>> = [],
  ) {
    const descoberta = {
      cadastrar: jest.fn().mockResolvedValue({
        status: 'JA_EXISTE',
        hardware: { id: 42, nome: 'RTX 5070 Teste' },
      }),
    };
    const hardwares = {
      buscarPorIdAdmin: jest.fn().mockResolvedValue({
        id: 42,
        nome: 'RTX 5070 Teste',
        produtoId: 7,
      }),
      listarTodos: jest.fn().mockResolvedValue(hardwaresExistentes),
    };
    const ofertas = {
      listarParceiros: jest.fn().mockResolvedValue({
        total: 2,
        parceiros: [
          {
            id: 2,
            nome: 'Shopee',
            dominio: 'shopee.com.br',
            ativo: true,
          },
          {
            id: 3,
            nome: 'Amazon',
            dominio: 'amazon.com.br',
            ativo: true,
          },
        ],
      }),
      listarOfertas: jest.fn().mockResolvedValue({
        total: ofertasExistentes.length,
        ofertas: ofertasExistentes,
      }),
      atualizarOferta: jest.fn().mockResolvedValue({ id: 9 }),
      criarOferta: jest.fn().mockResolvedValue({ id: 10 }),
      criarParceiro: jest.fn(),
    };
    const produtos = {
      criarDeHardware: jest.fn(),
      listarCategoriasAdmin: jest.fn().mockResolvedValue([
        {
          id: 12,
          nome: 'Monitores',
          slug: 'monitores',
          ativo: true,
        },
      ]),
      listarAdmin: jest.fn().mockResolvedValue(produtosExistentes),
      buscarAdmin: jest.fn().mockImplementation(async (id: number) => ({
        id,
        nome: id === 70 ? 'Echo Dot 5ª geração' : 'Monitor LG UltraGear 24',
        metadados: id === 70 ? { asin: 'B0ABC12345' } : null,
      })),
      atualizar: jest.fn().mockImplementation(async (id: number, dados: Record<string, unknown>) => ({
        id,
        nome: id === 70 ? 'Echo Dot 5ª geração' : 'Monitor LG UltraGear 24',
        ...dados,
      })),
      criar: jest.fn().mockResolvedValue({
        id: 51,
        nome: 'Monitor LG UltraGear 24',
        ofertas: [{ id: 11 }],
      }),
    };

    const service = new ProdutoIaIntegracaoInternaService(
      descoberta as unknown as HardwaresDescobertaIaService,
      hardwares as unknown as HardwaresService,
      ofertas as unknown as OfertasService,
      produtos as unknown as ProdutosService,
    );

    return { service, descoberta, hardwares, ofertas, produtos };
  }

  it('atualiza o mesmo anúncio de Hardware em vez de duplicar', async () => {
    const { service, ofertas, produtos } = setup([
      {
        id: 9,
        hardware: { id: 42 },
        parceiro: { id: 2 },
        urlOriginal: 'https://shopee.com.br/produto/123',
        codigoMarketplace: 'SHOPEE-123',
      },
    ]);

    const result = await service.importarOfertaExtensao(hardwarePayload);

    expect(result.status).toBe('OFERTA_ATUALIZADA');
    expect(result.publicado).toBe(true);
    expect(produtos.atualizar).toHaveBeenCalledWith(7, {
      publicado: true,
      ativo: true,
    });
    expect(ofertas.atualizarOferta).toHaveBeenCalledTimes(1);
    expect(ofertas.criarOferta).not.toHaveBeenCalled();
  });

  it('cria nova oferta de Hardware quando o anúncio ainda não existe', async () => {
    const { service, ofertas, produtos } = setup([]);

    const result = await service.importarOfertaExtensao(hardwarePayload);

    expect(result.status).toBe('NOVA_OFERTA_CRIADA');
    expect(result.publicado).toBe(true);
    expect(produtos.atualizar).toHaveBeenCalledWith(7, {
      publicado: true,
      ativo: true,
    });
    expect(ofertas.criarOferta).toHaveBeenCalledWith(
      expect.objectContaining({
        hardwareId: 42,
        parceiroId: 2,
        urlAfiliada: 'https://s.shopee.com.br/abc',
      }),
    );
  });

  it('produto da extensão não passa pelo cadastro de Hardware e é publicado', async () => {
    const { service, descoberta, ofertas, produtos } = setup([], [
      {
        id: 50,
        tipo: 'GENERICO',
        categoriaId: 12,
        nome: 'Monitor LG UltraGear 24',
        marca: 'LG',
        modelo: '24GN60R-B',
      },
    ]);

    const result = await service.importarOfertaExtensao(produtoPayload);

    expect(result.status).toBe('NOVA_OFERTA_CRIADA');
    expect(result.publicado).toBe(true);
    expect(descoberta.cadastrar).not.toHaveBeenCalled();
    expect(produtos.atualizar).toHaveBeenCalledWith(
      50,
      {
        publicado: true,
        ativo: true,
      },
    );
    expect(ofertas.criarOferta).toHaveBeenCalledWith(
      expect.objectContaining({
        produtoId: 50,
        parceiroId: 2,
        urlAfiliada: 'https://s.shopee.com.br/monitor456',
      }),
    );
  });

  it('cria Produto genérico publicado quando ainda não existe', async () => {
    const { service, produtos, descoberta } = setup([], []);

    const result = await service.importarOfertaExtensao(produtoPayload);

    expect(result.status).toBe('PRODUTO_E_OFERTA_CRIADOS');
    expect(result.publicado).toBe(true);
    expect(descoberta.cadastrar).not.toHaveBeenCalled();
    expect(produtos.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        categoriaId: 12,
        nome: 'Monitor LG UltraGear 24',
        marca: 'LG',
        modelo: '24GN60R-B',
        publicado: true,
        ativo: true,
        especificacaoMonitor: expect.objectContaining({
          taxaAtualizacaoHz: 144,
        }),
        ofertaInicial: expect.objectContaining({
          parceiroId: 2,
          preco: 899.9,
        }),
      }),
    );
  });

  it('atualiza e publica o mesmo anúncio de Produto sem criar duplicata', async () => {
    const { service, ofertas, produtos } = setup([
      {
        id: 9,
        produtoId: 50,
        parceiroId: 2,
        urlOriginal: 'https://shopee.com.br/monitor/456',
        codigoMarketplace: 'SHOPEE-MONITOR-456',
      },
    ]);

    const result = await service.importarOfertaExtensao(produtoPayload);

    expect(result.status).toBe('OFERTA_ATUALIZADA');
    expect(result.publicado).toBe(true);
    expect(produtos.atualizar).toHaveBeenCalledWith(
      50,
      expect.objectContaining({
        publicado: true,
        ativo: true,
      }),
    );
    expect(ofertas.atualizarOferta).toHaveBeenCalledTimes(1);
    expect(ofertas.criarOferta).not.toHaveBeenCalled();
    expect(produtos.criar).not.toHaveBeenCalled();
  });

  it('encontra Produto existente por ASIN antes de consultar Hardware', async () => {
    const { service, hardwares } = setup([], [
      {
        id: 70,
        tipo: 'GENERICO',
        nome: 'Echo Dot 5ª geração',
        marca: 'Amazon',
        modelo: 'Echo Dot 5',
        metadados: { asin: 'B0ABC12345' },
        publicado: true,
      },
    ]);

    const result = await service.buscarItemExtensao({ asin: 'b0abc12345' });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'EXISTENTE',
        tipo: 'PRODUTO',
        produtoId: 70,
        criterio: 'ASIN',
      }),
    );
    expect(hardwares.listarTodos).not.toHaveBeenCalled();
  });

  it('item já existente cria somente a oferta Amazon sem cadastro por IA', async () => {
    const { service, descoberta, ofertas, produtos } = setup([], [
      {
        id: 70,
        tipo: 'GENERICO',
        nome: 'Echo Dot 5ª geração',
        marca: 'Amazon',
        modelo: 'Echo Dot 5',
        metadados: { asin: 'B0ABC12345' },
      },
    ]);

    const result = await service.importarOfertaExtensao({
      produtoExistenteId: 70,
      parceiro: {
        nome: 'Amazon',
        dominio: 'amazon.com.br',
        site: 'https://amazon.com.br',
      },
      oferta: {
        urlOriginal: 'https://www.amazon.com.br/dp/B0ABC12345',
        urlAfiliada: 'https://amzn.to/exemplo',
        preco: 349.9,
        asin: 'B0ABC12345',
      },
    } as ImportarOfertaExtensaoProdutoIaDto);

    expect(result.status).toBe('ITEM_EXISTENTE_OFERTA_CRIADA');
    expect(result.completouComIa).toBe(false);
    expect(descoberta.cadastrar).not.toHaveBeenCalled();
    expect(produtos.criar).not.toHaveBeenCalled();
    expect(produtos.atualizar).toHaveBeenCalledWith(70, {
      publicado: true,
      ativo: true,
    });
    expect(ofertas.criarOferta).toHaveBeenCalledWith(
      expect.objectContaining({
        produtoId: 70,
        parceiroId: 3,
        codigoMarketplace: 'B0ABC12345',
        preco: 349.9,
      }),
    );
  });

  it('mantém dois vendedores do mesmo catálogo Mercado Livre no mesmo Produto e reenvio atualiza só a oferta', async () => {
    const catalogo = 'https://www.mercadolivre.com.br/monitor/p/MLB37817321';
    const anuncioAnterior = {
      id: 90, produtoId: 50, parceiroId: 2,
      urlOriginal: `${catalogo}?wid=MLB5953835688`,
      // Código legado de catálogo: não identifica o vendedor.
      codigoMarketplace: 'MLB37817321',
      vendedorIdentificador: '100', vendedorNome: 'Loja A',
      urlAfiliada: 'https://meli.la/loja-a', preco: 899.9,
    };
    const anuncios = [anuncioAnterior];
    const { service, ofertas, produtos } = setup(anuncios, [{
      id: 50, tipo: 'GENERICO', categoriaId: 12,
      marca: 'LG', modelo: '24GN60R-B',
    }]);
    ofertas.criarOferta.mockImplementation(async (dados) => {
      const oferta = { id: 91, ...dados };
      anuncios.push(oferta);
      return oferta;
    });
    const novo = {
      ...produtoPayload,
      oferta: {
        urlOriginal: `${catalogo}?item_id=MLB6740306774`,
        urlAfiliada: 'https://meli.la/loja-b', preco: 899.9,
        codigoMarketplace: 'MLB37817321',
        vendedorIdentificador: '200', vendedorNome: 'Loja B',
      },
    } as ImportarOfertaExtensaoProdutoIaDto;

    const criado = await service.importarOfertaExtensao(novo);
    expect(criado.status).toBe('NOVA_OFERTA_CRIADA');
    expect(criado.produto?.id).toBe(50);
    expect(anuncios).toHaveLength(2);
    expect(anuncios[0]).toEqual(anuncioAnterior);
    expect(anuncios[1]).toMatchObject({ produtoId: 50, urlAfiliada: 'https://meli.la/loja-b' });
    expect(ofertas.atualizarOferta).not.toHaveBeenCalled();
    expect(produtos.criar).not.toHaveBeenCalled();
    expect(produtos.atualizar).toHaveBeenCalledWith(50, { publicado: true, ativo: true });

    const reenviado = await service.importarOfertaExtensao({
      produtoExistenteId: 50,
      parceiro: novo.parceiro,
      oferta: { ...novo.oferta, preco: 850 },
    } as ImportarOfertaExtensaoProdutoIaDto);
    expect(reenviado.status).toBe('OFERTA_ATUALIZADA');
    expect(ofertas.atualizarOferta).toHaveBeenCalledWith(91, expect.objectContaining({ preco: 850 }));
    expect(ofertas.criarOferta).toHaveBeenCalledTimes(1);
    expect(anuncios).toHaveLength(2);
  });

  it('anúncios diferentes vinculam a oferta ao Hardware existente sem recadastrar', async () => {
    const { service, ofertas, descoberta } = setup([{
      id: 90, hardwareId: 42, parceiroId: 2,
      urlOriginal: 'https://www.mercadolivre.com.br/fonte/p/MLB37817321?wid=MLB5953835688',
      codigoMarketplace: 'MLB37817321',
    }]);
    const result = await service.importarOfertaExtensao({
      hardwareExistenteId: 42,
      parceiro: hardwarePayload.parceiro,
      oferta: {
        urlOriginal: 'https://www.mercadolivre.com.br/fonte/p/MLB37817321#pdp_filters=item_id:MLB6740306774',
        urlAfiliada: 'https://meli.la/outra-loja', preco: 199.9,
        codigoMarketplace: 'MLB37817321',
      },
    } as ImportarOfertaExtensaoProdutoIaDto);
    expect(result.status).toBe('ITEM_EXISTENTE_OFERTA_CRIADA');
    expect(ofertas.criarOferta).toHaveBeenCalledWith(expect.objectContaining({ hardwareId: 42 }));
    expect(ofertas.atualizarOferta).not.toHaveBeenCalled();
    expect(descoberta.cadastrar).not.toHaveBeenCalled();
  });
});
