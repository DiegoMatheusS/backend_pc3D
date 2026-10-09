import { mesmaPublicacaoMarketplace } from './identidade-publicacao';

describe('identidade de publicação', () => {
  const catalogo = 'https://www.mercadolivre.com.br/fonte/p/MLB37817321';
  const atual = {
    urlOriginal: `${catalogo}?wid=MLB5953835688`,
    codigoMarketplace: 'MLB37817321',
  };

  it.each([
    '?wid=MLB6740306774',
    '?item_id=MLB6740306774',
    '?pdp_filters=item_id%3AMLB6740306774',
    '#wid=MLB6740306774',
    '#pdp_filters=item_id:MLB6740306774',
  ])('distingue outro anúncio no mesmo catálogo: %s', (params) => {
    expect(
      mesmaPublicacaoMarketplace(atual, {
        ...atual,
        urlOriginal: catalogo + params,
      }),
    ).toBe(false);
  });

  it.each([
    '?item_id=MLB5953835688&utm_source=afiliado',
    '#wid=MLB5953835688',
    '?pdp_filters=item_id:MLB5953835688',
  ])('reconhece reenvio do mesmo anúncio: %s', (params) => {
    expect(
      mesmaPublicacaoMarketplace(atual, {
        urlOriginal: catalogo + params,
        codigoMarketplace: 'MLB5953835688',
      }),
    ).toBe(true);
  });

  it('reconhece anúncio tradicional mesmo quando o título ou domínio muda', () => {
    expect(
      mesmaPublicacaoMarketplace(atual, {
        urlOriginal:
          'https://produto.mercadolivre.com.br/MLB-5953835688-fonte-_JM',
      }),
    ).toBe(true);
  });

  it('não usa catálogo sem anúncio específico para sobrescrever anúncio conhecido', () => {
    expect(
      mesmaPublicacaoMarketplace(atual, {
        urlOriginal: catalogo,
        codigoMarketplace: 'MLB37817321',
      }),
    ).toBe(false);
  });

  it('reconhece código específico salvo mesmo quando a URL antiga não o guardou', () => {
    expect(
      mesmaPublicacaoMarketplace(
        { urlOriginal: catalogo, codigoMarketplace: 'MLB5953835688' },
        atual,
      ),
    ).toBe(true);
  });

  it('distingue vendedores identificados mesmo sem anúncio na URL', () => {
    expect(
      mesmaPublicacaoMarketplace(
        {
          urlOriginal: catalogo,
          codigoMarketplace: 'MLB37817321',
          vendedorIdentificador: '100',
        },
        {
          urlOriginal: catalogo,
          codigoMarketplace: 'MLB37817321',
          vendedorIdentificador: '200',
        },
      ),
    ).toBe(false);
  });

  it('códigos diferentes não caem na comparação por caminho igual', () => {
    expect(
      mesmaPublicacaoMarketplace(
        { urlOriginal: 'https://loja.com/produto', codigoMarketplace: 'A' },
        { urlOriginal: 'https://loja.com/produto', codigoMarketplace: 'B' },
      ),
    ).toBe(false);
  });

  it('mantém reenvio fora do Mercado Livre sem depender de rastreadores', () => {
    expect(
      mesmaPublicacaoMarketplace(
        { urlOriginal: 'https://shopee.com.br/produto/123?utm_source=a' },
        { urlOriginal: 'https://shopee.com.br/produto/123/' },
      ),
    ).toBe(true);
  });
});
