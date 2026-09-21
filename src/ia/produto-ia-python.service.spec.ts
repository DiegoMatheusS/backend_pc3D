import { ProdutoIaPythonService } from './produto-ia-python.service';

describe('proxy de enriquecimento técnico', () => {
  const originalUrl = process.env.PRODUTO_IA_URL;
  const originalKey = process.env.PRODUTO_IA_API_KEY;
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalUrl === undefined) delete process.env.PRODUTO_IA_URL;
    else process.env.PRODUTO_IA_URL = originalUrl;
    if (originalKey === undefined) delete process.env.PRODUTO_IA_API_KEY;
    else process.env.PRODUTO_IA_API_KEY = originalKey;
  });
  it('encaminha o link afiliado ao analisar uma URL', async () => {
    process.env.PRODUTO_IA_URL = 'https://ia.example.test';
    process.env.PRODUTO_IA_API_KEY = 'test';
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          categoriaDetectada: 'PLACA_VIDEO',
          payloadParcialBackend: { nome: 'RTX 5070' },
          ofertaColetada: { preco: 3999.9 },
        }),
        { status: 200 },
      ),
    );

    await new ProdutoIaPythonService().importarUrl(
      'https://www.mercadolivre.com.br/produto',
      undefined,
      {
        enrich: true,
        urlAfiliada: 'https://www.mercadolivre.com.br/sec/afiliado',
      },
    );

    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, unknown>;
    expect(body.urlAfiliada).toBe(
      'https://www.mercadolivre.com.br/sec/afiliado',
    );
  });

  it('preserva a mensagem estruturada da API Python', async () => {
    process.env.PRODUTO_IA_URL = 'https://ia.example.test';
    process.env.PRODUTO_IA_API_KEY = 'test';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            codigo: 'PARSER_SEM_DADOS',
            mensagem: 'Nenhum campo compatível encontrado',
          },
        }),
        { status: 422 },
      ),
    );
    await expect(
      new ProdutoIaPythonService().enriquecerIaTecnica({
        provedor: 'GEMINI',
        categoria: 'PROCESSADOR',
        payload: {},
      }),
    ).rejects.toThrow('Nenhum campo compatível encontrado');
  });
});
