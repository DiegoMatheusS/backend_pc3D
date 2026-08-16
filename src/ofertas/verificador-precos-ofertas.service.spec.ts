import { VerificadorPrecosOfertasService } from './verificador-precos-ofertas.service';

type ExtratorTeste = {
  extrairPrecoEstruturado(html: string): {
    preco: number | null;
    origem: 'JSON_LD' | 'META' | null;
    indisponivel: boolean;
  };
};

describe('VerificadorPrecosOfertasService', () => {
  const service = new VerificadorPrecosOfertasService();
  const extrator = service as unknown as ExtratorTeste;

  it('extrai preço confiável de Offer em JSON-LD', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {
            "@context":"https://schema.org",
            "@type":"Product",
            "name":"Produto teste",
            "offers":{"@type":"Offer","price":"3699.90","availability":"https://schema.org/InStock"}
          }
        </script>
      </head></html>`;

    expect(extrator.extrairPrecoEstruturado(html)).toEqual({
      preco: 3699.9,
      origem: 'JSON_LD',
      indisponivel: false,
    });
  });

  it('aceita meta product:price:amount quando não existe JSON-LD utilizável', () => {
    const html =
      '<html><head><meta property="product:price:amount" content="1.299,90"></head></html>';

    expect(extrator.extrairPrecoEstruturado(html)).toEqual({
      preco: 1299.9,
      origem: 'META',
      indisponivel: false,
    });
  });

  it('detecta indisponibilidade estruturada sem inventar preço', () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","offers":{"@type":"Offer","availability":"https://schema.org/OutOfStock"}}
      </script>`;

    expect(extrator.extrairPrecoEstruturado(html)).toEqual({
      preco: null,
      origem: null,
      indisponivel: true,
    });
  });
});
