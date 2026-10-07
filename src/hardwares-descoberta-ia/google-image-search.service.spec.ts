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
  const originalKey = process.env.GOOGLE_IMAGE_SEARCH_API_KEY;
  const originalCx = process.env.GOOGLE_IMAGE_SEARCH_CX;
  const originalTimeout = process.env.GOOGLE_IMAGE_SEARCH_TIMEOUT_MS;

  beforeEach(() => {
    process.env.GOOGLE_IMAGE_SEARCH_API_KEY = 'teste-key';
    process.env.GOOGLE_IMAGE_SEARCH_CX = 'teste-cx';
    process.env.GOOGLE_IMAGE_SEARCH_TIMEOUT_MS = '8000';
    jest.mocked(validarUrlPublica).mockImplementation(async (url) => ({
      url: new URL(url),
      endereco: '8.8.8.8',
      familia: 4,
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();

    if (originalKey === undefined) delete process.env.GOOGLE_IMAGE_SEARCH_API_KEY;
    else process.env.GOOGLE_IMAGE_SEARCH_API_KEY = originalKey;

    if (originalCx === undefined) delete process.env.GOOGLE_IMAGE_SEARCH_CX;
    else process.env.GOOGLE_IMAGE_SEARCH_CX = originalCx;

    if (originalTimeout === undefined) delete process.env.GOOGLE_IMAGE_SEARCH_TIMEOUT_MS;
    else process.env.GOOGLE_IMAGE_SEARCH_TIMEOUT_MS = originalTimeout;
  });

  it('busca no Google Imagens e aceita correspondência forte de marca/modelo', async () => {
    jest.mocked(requisitarUrlPublicaUmaVez).mockResolvedValue({
      status: 200,
      ok: true,
      url: new URL('https://customsearch.googleapis.com/customsearch/v1'),
      headers: {},
      corpo: Buffer.from(
        JSON.stringify({
          items: [
            {
              title: 'ASUS GeForce RTX 4060 DUAL OC 8GB',
              snippet: 'Placa de vídeo ASUS RTX 4060 Dual OC',
              displayLink: 'asus.com',
              link: 'https://cdn.exemplo.com/asus-rtx4060.jpg',
              image: {
                contextLink:
                  'https://www.asus.com/br/motherboards-components/graphics-cards/dual/dual-rtx4060-o8g/',
              },
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
      marca: 'ASUS',
      modelo: 'RTX 4060 Dual OC',
    });

    const chamada = jest.mocked(requisitarUrlPublicaUmaVez).mock.calls[0]?.[0];
    const url = chamada instanceof URL ? chamada : new URL(String(chamada));
    expect(url.searchParams.get('searchType')).toBe('image');
    expect(url.searchParams.get('num')).toBe('10');
    expect(url.searchParams.get('safe')).toBe('active');
    expect(url.searchParams.get('q')).toContain('ASUS');
    expect(url.searchParams.get('q')).toContain('RTX 4060 Dual OC');
  });

  it('descarta resultado sem identidade forte', async () => {
    jest.mocked(requisitarUrlPublicaUmaVez).mockResolvedValue({
      status: 200,
      ok: true,
      url: new URL('https://customsearch.googleapis.com/customsearch/v1'),
      headers: {},
      corpo: Buffer.from(
        JSON.stringify({
          items: [
            {
              title: 'Placa de vídeo genérica',
              snippet: 'GPU para jogos',
              displayLink: 'exemplo.com',
              link: 'https://cdn.exemplo.com/generica.jpg',
              image: { contextLink: 'https://exemplo.com/generica' },
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

  it('não consulta o Google sem API key e cx', async () => {
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

  it('faz somente um retry controlado quando o Google retorna 429', async () => {
    jest.mocked(requisitarUrlPublicaUmaVez)
      .mockResolvedValueOnce({
        status: 429,
        ok: false,
        url: new URL('https://customsearch.googleapis.com/customsearch/v1'),
        headers: {},
        corpo: Buffer.from('{}'),
      })
      .mockResolvedValueOnce({
        status: 429,
        ok: false,
        url: new URL('https://customsearch.googleapis.com/customsearch/v1'),
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
