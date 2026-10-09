import { HardwaresDescobertaIaService } from '../hardwares-descoberta-ia/hardwares-descoberta-ia.service';
import { HardwaresService } from '../hardwares/hardwares.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { ProdutosService } from '../produtos/produtos.service';
import { BuildsCatalogoService } from '../builds/builds-catalogo.service';
import { CriarBuildDto } from '../builds/dtos/criar-build.dto';
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
      atualizar: jest
        .fn()
        .mockImplementation(
          async (id: number, dados: Record<string, unknown>) => ({
            id,
            nome: id === 70 ? 'Echo Dot 5ª geração' : 'Monitor LG UltraGear 24',
            ...dados,
          }),
        ),
      criar: jest.fn().mockResolvedValue({
        id: 51,
        nome: 'Monitor LG UltraGear 24',
        ofertas: [{ id: 11 }],
      }),
    };

    const builds = {
      criar: jest.fn().mockResolvedValue({
        id: 80,
        produtoId: 81,
        produto: { nome: 'PC Gamer Teste 16GB SSD 1TB', ofertas: [{ id: 82 }] },
      }),
    };
    const service = new ProdutoIaIntegracaoInternaService(
      descoberta as unknown as HardwaresDescobertaIaService,
      hardwares as unknown as HardwaresService,
      ofertas as unknown as OfertasService,
      produtos as unknown as ProdutosService,
      builds as unknown as BuildsCatalogoService,
    );

    return { service, descoberta, hardwares, ofertas, produtos, builds };
  }

  const buildPayload = {
    buildPayload: {
      nome: 'PC Gamer Teste 16GB SSD 1TB',
      marca: 'Teste',
      modelo: 'Ryzen 5',
      categoria: 'PC_MONTADO',
      descricao: 'Ryzen 5, 16 GB RAM, SSD 1 TB. Garantia de 12 meses.',
    },
    parceiro: produtoPayload.parceiro,
    oferta: { ...produtoPayload.oferta, preco: 3999.9, precoAnterior: 4299.9 },
  } satisfies ImportarOfertaExtensaoProdutoIaDto;

  it('cadastra PC comercial publicado com oferta inicial e sem inventar peças', async () => {
    const { service, builds, produtos, descoberta, ofertas } = setup();
    const result = await service.importarOfertaExtensao(buildPayload);
    expect(result.status).toBe('BUILD_E_OFERTA_CRIADOS');
    expect(result.produto?.id).toBe(81);
    const call = (builds.criar.mock.calls as [CriarBuildDto][])[0][0];
    expect(call).toMatchObject({
      ...buildPayload.buildPayload,
      publicado: true,
      ativo: true,
      componentes: [],
      oferta: {
        parceiroId: 2,
        preco: 3999.9,
        precoAnterior: 4299.9,
        urlAfiliada: buildPayload.oferta.urlAfiliada,
        codigoMarketplace: buildPayload.oferta.codigoMarketplace,
      },
    });
    expect(produtos.criar).not.toHaveBeenCalled();
    expect(descoberta.cadastrar).not.toHaveBeenCalled();
    expect(ofertas.criarOferta).not.toHaveBeenCalled();
  });

  it('reaproveita o mesmo PC e mantém a descrição cadastrada', async () => {
    const { service, builds, produtos, ofertas } = setup(
      [],
      [
        {
          id: 81,
          tipo: 'BUILD',
          ...buildPayload.buildPayload,
        },
      ],
    );
    const result = await service.importarOfertaExtensao(buildPayload);
    expect(result.status).toBe('NOVA_OFERTA_CRIADA');
    expect(builds.criar).not.toHaveBeenCalled();
    expect(produtos.atualizar).toHaveBeenCalledWith(81, {
      publicado: true,
      ativo: true,
    });
    expect(ofertas.criarOferta).toHaveBeenCalledWith(
      expect.objectContaining({ produtoId: 81 }),
    );
  });

  it('atualiza o mesmo anúncio de PC sem criar outra oferta', async () => {
    const { service, builds, ofertas } = setup(
      [
        {
          id: 9,
          produtoId: 81,
          parceiro: { id: 2 },
          urlOriginal: buildPayload.oferta.urlOriginal,
          codigoMarketplace: buildPayload.oferta.codigoMarketplace,
        },
      ],
      [{ id: 81, tipo: 'BUILD', ...buildPayload.buildPayload }],
    );
    expect((await service.importarOfertaExtensao(buildPayload)).status).toBe(
      'OFERTA_ATUALIZADA',
    );
    expect(builds.criar).not.toHaveBeenCalled();
    expect(ofertas.atualizarOferta).toHaveBeenCalledTimes(1);
    expect(ofertas.criarOferta).not.toHaveBeenCalled();
  });

  it.each([
    {
      id: 1,
      tipo: 'BUILD',
      ...buildPayload.buildPayload,
      nome: 'PC Gamer Teste RTX 5070 16GB SSD 1TB',
    },
    { id: 1, tipo: 'HARDWARE', ...buildPayload.buildPayload },
    {
      id: 1,
      tipo: 'BUILD',
      ...buildPayload.buildPayload,
      build: { categoria: 'KIT_UPGRADE' },
    },
  ])(
    'não liga a oferta a outra configuração, peça ou kit',
    async (existing) => {
      const { service, builds, ofertas } = setup([], [existing]);
      await service.importarOfertaExtensao(buildPayload);
      expect(builds.criar).toHaveBeenCalledTimes(1);
      expect(ofertas.criarOferta).not.toHaveBeenCalled();
    },
  );

  it('recusa anúncio de PC já ligado a outro tipo de produto', async () => {
    const { service, builds, ofertas } = setup(
      [
        {
          id: 9,
          produtoId: 81,
          parceiro: { id: 2 },
          urlOriginal: buildPayload.oferta.urlOriginal,
        },
      ],
      [{ id: 81, tipo: 'HARDWARE' }],
    );
    await expect(service.importarOfertaExtensao(buildPayload)).rejects.toThrow(
      'outro tipo',
    );
    expect(builds.criar).not.toHaveBeenCalled();
    expect(ofertas.atualizarOferta).not.toHaveBeenCalled();
  });

  it('pede revisão quando há dois PCs correspondentes', async () => {
    const { service, builds } = setup(
      [],
      [
        { id: 81, tipo: 'BUILD', ...buildPayload.buildPayload },
        { id: 82, tipo: 'BUILD', ...buildPayload.buildPayload },
      ],
    );
    await expect(service.importarOfertaExtensao(buildPayload)).rejects.toThrow(
      'Mais de um PC',
    );
    expect(builds.criar).not.toHaveBeenCalled();
  });

  it('recusa PC sem descrição antes de criar parceiros ou catálogo', async () => {
    const { service, builds, ofertas } = setup();
    await expect(
      service.importarOfertaExtensao({
        ...buildPayload,
        buildPayload: { ...buildPayload.buildPayload, descricao: ' ' },
      }),
    ).rejects.toThrow('descrição');
    expect(builds.criar).not.toHaveBeenCalled();
    expect(ofertas.listarParceiros).not.toHaveBeenCalled();
  });

  it('recusa payload BUILD junto com outro destino de cadastro', async () => {
    const { service, builds } = setup();
    await expect(
      service.importarOfertaExtensao({
        ...buildPayload,
        produtoPayload: produtoPayload.produtoPayload,
      }),
    ).rejects.toThrow();
    expect(builds.criar).not.toHaveBeenCalled();
  });

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
    const { service, descoberta, ofertas, produtos } = setup(
      [],
      [
        {
          id: 50,
          tipo: 'GENERICO',
          categoriaId: 12,
          nome: 'Monitor LG UltraGear 24',
          marca: 'LG',
          modelo: '24GN60R-B',
        },
      ],
    );

    const result = await service.importarOfertaExtensao(produtoPayload);

    expect(result.status).toBe('NOVA_OFERTA_CRIADA');
    expect(result.publicado).toBe(true);
    expect(descoberta.cadastrar).not.toHaveBeenCalled();
    expect(produtos.atualizar).toHaveBeenCalledWith(
      50,
      expect.objectContaining({
        publicado: true,
        ativo: true,
        nome: 'Monitor LG UltraGear 24',
        especificacaoMonitor: expect.objectContaining({
          taxaAtualizacaoHz: 144,
        }),
      }),
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
    const { service, hardwares } = setup(
      [],
      [
        {
          id: 70,
          tipo: 'GENERICO',
          nome: 'Echo Dot 5ª geração',
          marca: 'Amazon',
          modelo: 'Echo Dot 5',
          metadados: { asin: 'B0ABC12345' },
          publicado: true,
        },
      ],
    );

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
    const { service, descoberta, ofertas, produtos } = setup(
      [],
      [
        {
          id: 70,
          tipo: 'GENERICO',
          nome: 'Echo Dot 5ª geração',
          marca: 'Amazon',
          modelo: 'Echo Dot 5',
          metadados: { asin: 'B0ABC12345' },
        },
      ],
    );

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
});
