import {
  requisitarUrlPublicaUmaVez,
  validarUrlPublica,
} from '../common/security/external-http-security';
import { GoogleImageSearchService } from './google-image-search.service';

jest.mock('../common/security/external-http-security', () => ({
  obterCabecalhoHttp: jest.fn(() => undefined),
  requisitarUrlPublicaUmaVez: jest.fn(),
  validarUrlPublica: jest.fn(),
}));

describe('GoogleImageSearchService', () => {
  const originalSerpApi = process.env.SERPAPI_API_KEY;
  const originalGoogleKey = process.env.GOOGLE_IMAGE_SEARCH_API_KEY;
  const originalGoogleCx = process.env.GOOGLE_IMAGE_SEARCH_CX;
  const originalTimeout = process.env.GOOGLE_IMAGE_SEARCH_TIMEOUT_MS;

  beforeEach(() => {
    process.env.SERPAPI_API_KEY = 'serpapi-test';
    delete process.env.GOOGLE_IMAGE_SEARCH_API_KEY;
    delete process.env.GOOGLE_IMAGE_SEARCH_CX;
    process.env.GOOGLE_IMAGE_SEARCH_TIMEOUT_MS = '8000';
    jest.mocked(validarUrlPublica).mockImplementation(async (url) => ({
      url: new URL(url),
      endereco: '8.8.8.8',
      familia: 4,
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();

    if (originalSerpApi === undefined) delete process.env.SERPAPI_API_KEY;
    else process.env.SERPAPI_API_KEY = originalSerpApi;

    if (originalGoogleKey === undefined) delete process.env.GOOGLE_IMAGE_SEARCH_API_KEY;
    else process.env.GOOGLE_IMAGE_SEARCH_API_KEY = originalGoogleKey;

    if (originalGoogleCx === undefined) delete process.env.GOOGLE_IMAGE_SEARCH_CX;
    else process.env.GOOGLE_IMAGE_SEARCH_CX = originalGoogleCx;

    if (originalTimeout === undefined) delete process.env.GOOGLE_IMAGE_SEARCH_TIMEOUT_MS;
    else process.env.GOOGLE_IMAGE_SEARCH_TIMEOUT_MS = originalTimeout;
  });

  it('busca no Google Imagens via SerpApi e aceita correspondência forte', async () => {
    jest.mocked(requisitarUrlPublicaUmaVez).mockResolvedValue({
      status: 200,
      ok: true,
      url: new URL('https://serpapi.com/search.json'),
      headers: {},
      corpo: Buffer.from(
        JSON.stringify({
          images_results: [
            {
              title: 'ASUS GeForce RTX 4060 DUAL OC 8GB',
              source: 'ASUS',
              link:
                'https://www.asus.com/br/motherboards-components/graphics-cards/dual/dual-rtx4060-o8g/',
              original: 'https://cdn.exemplo.com/asus-rtx4060.jpg',
            },
          ],
        }),
      ),
    });

    const service = new GoogleImageSearchService();
    const resultado = await service.buscar({
      nome: 'Placa de vídeo ASUS Dual GeForce RTX 4060 OC 8GB',
      marca: 'ASUS',
      modelo: 'RTX 4060 Dual OC',
      mpn: null,
      gtin: null,
    });

    expect(resultado).toMatchObject({
      imagemUrl: 'https://cdn.exemplo.com/asus-rtx4060.jpg',
      fonte: 'GOOGLE_IMAGENS',
      provedor: 'SERPAPI',
      marca: 'ASUS',
      modelo: 'RTX 4060 Dual OC',
    });

    const chamada = jest.mocked(requisitarUrlPublicaUmaVez).mock.calls[0]?.[0];
    const url = chamada instanceof URL ? chamada : new URL(String(chamada));
    expect(url.hostname).toBe('serpapi.com');
    expect(url.searchParams.get('engine')).toBe('google_images');
    expect(url.searchParams.get('q')).toContain('ASUS');
    expect(url.searchParams.get('q')).toContain('RTX 4060 Dual OC');
  });

  it('descarta resultado sem identidade forte', async () => {
    jest.mocked(requisitarUrlPublicaUmaVez).mockResolvedValue({
      status: 200,
      ok: true,
      url: new URL('https://serpapi.com/search.json'),
      headers: {},
      corpo: Buffer.from(
        JSON.stringify({
          images_results: [
            {
              title: 'Placa de vídeo genérica',
              source: 'Loja genérica',
              link: 'https://exemplo.com/generica',
              original: 'https://cdn.exemplo.com/generica.jpg',
            },
          ],
        }),
      ),
    });

    const service = new GoogleImageSearchService();
    await expect(
      service.buscar({
        nome: 'ASUS Dual GeForce RTX 4060 OC 8GB',
        marca: 'ASUS',
        modelo: 'RTX 4060 Dual OC',
      }),
    ).resolves.toBeNull();
    expect(validarUrlPublica).not.toHaveBeenCalled();
  });

  it('mantém a API Google antiga como fallback para clientes já habilitados', async () => {
    delete process.env.SERPAPI_API_KEY;
    process.env.GOOGLE_IMAGE_SEARCH_API_KEY = 'google-test';
    process.env.GOOGLE_IMAGE_SEARCH_CX = 'cx-test';

    jest.mocked(requisitarUrlPublicaUmaVez).mockResolvedValue({
      status: 200,
      ok: true,
      url: new URL('https://customsearch.googleapis.com/customsearch/v1'),
      headers: {},
      corpo: Buffer.from(
        JSON.stringify({
          items: [
            {
              title: 'ASUS RTX 4060 Dual OC',
              snippet: 'ASUS RTX 4060 Dual OC',
              displayLink: 'asus.com',
              link: 'https://cdn.exemplo.com/google-rtx4060.jpg',
              image: { contextLink: 'https://asus.com/rtx4060' },
            },
          ],
        }),
      ),
    });

    const service = new GoogleImageSearchService();
    await expect(
      service.buscar({
        nome: 'ASUS RTX 4060 Dual OC',
        marca: 'ASUS',
        modelo: 'RTX 4060 Dual OC',
      }),
    ).resolves.toMatchObject({
      fonte: 'GOOGLE_IMAGENS',
      provedor: 'GOOGLE_CUSTOM_SEARCH',
      imagemUrl: 'https://cdn.exemplo.com/google-rtx4060.jpg',
    });
  });

  it('não consulta o Google sem nenhum provedor configurado', async () => {
    delete process.env.SERPAPI_API_KEY;
    delete process.env.GOOGLE_IMAGE_SEARCH_API_KEY;
    delete process.env.GOOGLE_IMAGE_SEARCH_CX;

    const service = new GoogleImageSearchService();
    await expect(
      service.buscar({
        nome: 'ASUS RTX 4060',
        marca: 'ASUS',
        modelo: 'RTX 4060',
      }),
    ).resolves.toBeNull();

    expect(requisitarUrlPublicaUmaVez).not.toHaveBeenCalled();
  });

  it('faz somente um retry controlado quando o provedor retorna 429', async () => {
    jest.mocked(requisitarUrlPublicaUmaVez)
      .mockResolvedValueOnce({
        status: 429,
        ok: false,
        url: new URL('https://serpapi.com/search.json'),
        headers: {},
        corpo: Buffer.from('{}'),
      })
      .mockResolvedValueOnce({
        status: 429,
        ok: false,
        url: new URL('https://serpapi.com/search.json'),
        headers: {},
        corpo: Buffer.from('{}'),
      });

    const service = new GoogleImageSearchService();
    await expect(
      service.buscar({
        nome: 'ASUS RTX 4060',
        marca: 'ASUS',
        modelo: 'RTX 4060',
      }),
    ).resolves.toBeNull();

    expect(requisitarUrlPublicaUmaVez).toHaveBeenCalledTimes(2);
  });
});
