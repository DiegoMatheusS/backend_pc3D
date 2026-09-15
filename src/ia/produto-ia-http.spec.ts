import { postProdutoIa } from './produto-ia-http';

describe('POST Produto IA', () => {
  afterEach(() => jest.restoreAllMocks());
  it('preserva método, corpo e chave em redirect interno', async () => {
    const request = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/ia-tecnica/enriquecer/' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const options = { body: '{"categoria":"MEMORIA_RAM"}', headers: { 'X-API-Key': 'test-only' } };
    const result = await postProdutoIa('https://ia.example/ia-tecnica/enriquecer', options);
    expect(result.status).toBe(200);
    expect(request).toHaveBeenLastCalledWith('https://ia.example/ia-tecnica/enriquecer/', {
      ...options, method: 'POST', redirect: 'manual',
    });
  });
  it('não encaminha chave para outra origem', async () => {
    const request = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://other.example/' } }));
    await expect(postProdutoIa('https://ia.example/analisar', {})).rejects.toThrow('outra origem');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('interrompe loops', async () => {
    const request = jest.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(null, { status: 307, headers: { location: '/analisar' } }));
    await expect(postProdutoIa('https://ia.example/analisar', {})).rejects.toThrow('excessivo');
    expect(request).toHaveBeenCalledTimes(4);
  });
});
