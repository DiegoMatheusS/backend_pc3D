import { HardwaresDescobertaIaService } from '../hardwares-descoberta-ia/hardwares-descoberta-ia.service';
import { HardwaresService } from '../hardwares/hardwares.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { ProdutosService } from '../produtos/produtos.service';
import { ImportarOfertaExtensaoProdutoIaDto } from './dtos/importar-oferta-extensao-produto-ia.dto';
import { ProdutoIaIntegracaoInternaService } from './produto-ia-integracao-interna.service';

describe('ProdutoIaIntegracaoInternaService', () => {
  const payload = {
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

  function setup(ofertasExistentes: Array<Record<string, unknown>> = []) {
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
    };

    const service = new ProdutoIaIntegracaoInternaService(
      descoberta as unknown as HardwaresDescobertaIaService,
      hardwares as unknown as HardwaresService,
      ofertas as unknown as OfertasService,
      produtos as unknown as ProdutosService,
    );

    return { service, descoberta, hardwares, ofertas, produtos };
  }

  it('atualiza o mesmo anúncio em vez de duplicar', async () => {
    const { service, ofertas } = setup([
      {
        id: 9,
        hardware: { id: 42 },
        parceiro: { id: 2 },
        urlOriginal: 'https://shopee.com.br/produto/123',
        codigoMarketplace: 'SHOPEE-123',
      },
    ]);

    const result = await service.importarOfertaExtensao(payload);

    expect(result.status).toBe('OFERTA_ATUALIZADA');
    expect(ofertas.atualizarOferta).toHaveBeenCalledTimes(1);
    expect(ofertas.criarOferta).not.toHaveBeenCalled();
  });

  it('cria nova oferta quando o anúncio ainda não existe', async () => {
    const { service, ofertas } = setup([]);

    const result = await service.importarOfertaExtensao(payload);

    expect(result.status).toBe('NOVA_OFERTA_CRIADA');
    expect(ofertas.criarOferta).toHaveBeenCalledWith(
      expect.objectContaining({
        hardwareId: 42,
        parceiroId: 2,
        urlAfiliada: 'https://s.shopee.com.br/abc',
      }),
    );
  });
});
