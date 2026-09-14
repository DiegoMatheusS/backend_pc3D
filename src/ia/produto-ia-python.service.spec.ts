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
