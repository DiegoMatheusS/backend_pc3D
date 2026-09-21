import { hostCompativelComParceiro } from './marketplace-domains';

describe('hostCompativelComParceiro', () => {
  it('trata Magazine Luiza, Magazine Você e Magalu como o mesmo parceiro', () => {
    expect(
      hostCompativelComParceiro(
        'www.magazineluiza.com.br',
        'magazinevoce.com.br',
      ),
    ).toBe(true);
    expect(
      hostCompativelComParceiro('magalu.com', 'magazineluiza.com.br'),
    ).toBe(true);
    expect(
      hostCompativelComParceiro(
        'www.magazinevoce.com.br',
        'magazineluiza.com.br',
      ),
    ).toBe(true);
  });

  it('mantém o casamento normal de subdomínios', () => {
    expect(
      hostCompativelComParceiro(
        'produto.mercadolivre.com.br',
        'mercadolivre.com.br',
      ),
    ).toBe(true);
    expect(
      hostCompativelComParceiro('s.shopee.com.br', 'shopee.com.br'),
    ).toBe(true);
  });

  it('não mistura marketplaces diferentes', () => {
    expect(
      hostCompativelComParceiro('magazineluiza.com.br', 'shopee.com.br'),
    ).toBe(false);
  });
});
