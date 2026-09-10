import request from 'supertest';
import { App, criarApp, loginAdmin } from './app-setup';

describe('IA técnica — enriquecimento de Hardware (e2e)', () => {
  let app: App;
  let cookieAdmin: string;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const produtoIaUrlAnterior = process.env.PRODUTO_IA_URL;
  const produtoIaApiKeyAnterior = process.env.PRODUTO_IA_API_KEY;

  beforeAll(async () => {
    app = await criarApp();
    cookieAdmin = await loginAdmin(app);
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  beforeEach(() => {
    process.env.PRODUTO_IA_URL = 'https://produto-ia.e2e.test';
    process.env.PRODUTO_IA_API_KEY = 'chave-e2e';
    fetchMock.mockReset();
  });

  afterAll(async () => {
    fetchMock.mockRestore();

    if (produtoIaUrlAnterior === undefined) {
      delete process.env.PRODUTO_IA_URL;
    } else {
      process.env.PRODUTO_IA_URL = produtoIaUrlAnterior;
    }

    if (produtoIaApiKeyAnterior === undefined) {
      delete process.env.PRODUTO_IA_API_KEY;
    } else {
      process.env.PRODUTO_IA_API_KEY = produtoIaApiKeyAnterior;
    }

    if (app) await app.close();
  });

  it('faz proxy para /ia-tecnica/enriquecer e preenche somente lacunas', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          utilizado: true,
          provedor: 'GEMINI',
          categoria: 'PROCESSADOR',
          nome: 'AMD Ryzen 9 7900',
          coberturaAntes: 0.5,
          coberturaDepois: 0.9,
          camposPreenchidos: ['socket', 'tdpWatts', 'cacheL3Mb'],
          camposAusentes: [],
          statusFicha: 'PRONTO',
          payload: {
            nome: 'Nome incorreto da IA',
            marca: 'Marca incorreta',
            especificacaoProcessador: {
              socket: 'AM4',
              tdpWatts: 65,
              cacheL3Mb: 64,
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const res = await request(app.getHttpServer())
      .post('/api/admin/hardwares/descobrir/ia-tecnica/enriquecer')
      .set('Cookie', cookieAdmin)
      .send({
        provedor: 'GEMINI',
        categoria: 'PROCESSADOR',
        nome: 'AMD Ryzen 9 7900',
        payload: {
          nome: 'AMD Ryzen 9 7900',
          marca: 'AMD',
          especificacaoProcessador: {
            socket: 'AM5',
            tdpWatts: null,
            cacheL3Mb: '',
          },
        },
        somentePreencheLacunas: true,
      });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://produto-ia.e2e.test/ia-tecnica/enriquecer',
    );

    const opcoesFetch = fetchMock.mock.calls[0]?.[1];
    expect(opcoesFetch?.method).toBe('POST');
    expect(opcoesFetch?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-API-Key': 'chave-e2e',
    });
    const corpoFetch = opcoesFetch?.body;
    expect(typeof corpoFetch).toBe('string');
    expect(JSON.parse(corpoFetch as string)).toMatchObject({
      provedor: 'GEMINI',
      categoria: 'PROCESSADOR',
      nome: 'AMD Ryzen 9 7900',
      somentePreencheLacunas: true,
    });

    expect(res.body).toMatchObject({
      utilizado: true,
      provedor: 'GEMINI',
      coberturaAntes: 0.5,
      coberturaDepois: 0.9,
      camposAusentes: [],
      statusFicha: 'PRONTO',
      payload: {
        nome: 'AMD Ryzen 9 7900',
        marca: 'AMD',
        especificacaoProcessador: {
          socket: 'AM5',
          tdpWatts: 65,
          cacheL3Mb: 64,
        },
      },
    });
    expect(res.body.camposPreenchidos).toEqual(
      expect.arrayContaining(['tdpWatts', 'cacheL3Mb']),
    );
    expect(res.body.camposPreenchidos).not.toContain('socket');
  });

  it('recusa provider fora da lista permitida antes de chamar a Produto IA', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/hardwares/descobrir/ia-tecnica/enriquecer')
      .set('Cookie', cookieAdmin)
      .send({
        provedor: 'PROVEDOR_INVALIDO',
        categoria: 'PROCESSADOR',
        nome: 'AMD Ryzen 9 7900',
        payload: {},
      });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
