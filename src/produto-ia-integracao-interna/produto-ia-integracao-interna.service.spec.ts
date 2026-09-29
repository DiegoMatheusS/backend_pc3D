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
    };
    const ofertas = {
      listarParceiros: jest.fn().mockResolvedValue({
        total: 1,
        parceiros: [
          {
            id: 2,
            nome: 'Shopee',
            dominio: 'shopee.com.br',
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
        nome: 'Monitor LG UltraGear 24',
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
    const { service, ofertas } = setup([
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
    expect(ofertas.atualizarOferta).toHaveBeenCalledTimes(1);
    expect(ofertas.criarOferta).not.toHaveBeenCalled();
  });

  it('cria nova oferta de Hardware quando o anúncio ainda não existe', async () => {
    const { service, ofertas } = setup([]);

    const result = await service.importarOfertaExtensao(hardwarePayload);

    expect(result.status).toBe('NOVA_OFERTA_CRIADA');
    expect(ofertas.criarOferta).toHaveBeenCalledWith(
      expect.objectContaining({
        hardwareId: 42,
        parceiroId: 2,
        urlAfiliada: 'https://s.shopee.com.br/abc',
      }),
    );
  });

  it('produto da extensão não passa pelo cadastro de Hardware', async () => {
    const { service, descoberta, ofertas } = setup([], [
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
    expect(descoberta.cadastrar).not.toHaveBeenCalled();
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

  it('atualiza o mesmo anúncio de Produto sem criar duplicata', async () => {
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
    expect(ofertas.atualizarOferta).toHaveBeenCalledTimes(1);
    expect(ofertas.criarOferta).not.toHaveBeenCalled();
    expect(produtos.criar).not.toHaveBeenCalled();
  });
});
