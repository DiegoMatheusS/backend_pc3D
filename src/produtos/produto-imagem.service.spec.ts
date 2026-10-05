import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validarUrlPublica } from '../common/security/external-http-security';
import { postProdutoIa } from '../ia/produto-ia-http';
import { BuscarImagemProdutoDto } from './dtos/buscar-imagem-produto.dto';
import { ProdutoImagemService } from './produto-imagem.service';

jest.mock('../ia/produto-ia-http', () => ({ postProdutoIa: jest.fn() }));
jest.mock('../common/security/external-http-security', () => ({
  validarUrlPublica: jest.fn(),
}));

describe('busca de imagem comercial do Produto', () => {
  const originalUrl = process.env.PRODUTO_IA_URL;
  const originalKey = process.env.PRODUTO_IA_API_KEY;
  const dados = { nome: 'Placa Zotac RTX 4060', marca: 'Zotac', modelo: 'RTX 4060' };
  const service = new ProdutoImagemService();

  beforeEach(() => {
    process.env.PRODUTO_IA_URL = 'https://ia.test/';
    process.env.PRODUTO_IA_API_KEY = 'test';
    jest.mocked(validarUrlPublica).mockImplementation(async (url) => ({
      url: new URL(url), endereco: '8.8.8.8', familia: 4,
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
    if (originalUrl === undefined) delete process.env.PRODUTO_IA_URL;
    else process.env.PRODUTO_IA_URL = originalUrl;
    if (originalKey === undefined) delete process.env.PRODUTO_IA_API_KEY;
    else process.env.PRODUTO_IA_API_KEY = originalKey;
  });

  function ofertas(items: unknown[]) {
    jest.mocked(postProdutoIa).mockResolvedValue(
      new Response(JSON.stringify({ ofertas: items })),
    );
  }

  it('retorna a URL direta da imagem, preservando parâmetros e origem', async () => {
    const imagemUrl = 'https://http2.mlstatic.com/foto.webp?width=1200&quality=90';
    ofertas([{ imagemUrl, urlOriginal: 'https://mercadolivre.com.br/produto', parceiro: 'Mercado Livre', criterioIdentidade: 'MARCA_MODELO' }]);
    await expect(service.buscar(dados)).resolves.toMatchObject({
      imagemUrl, urlFonte: 'https://mercadolivre.com.br/produto', fonte: 'Mercado Livre',
    });
    expect(postProdutoIa).toHaveBeenCalledWith(
      'https://ia.test/ofertas/produto-identico', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ...dados, mpn: null, gtin: null, limitePorLoja: 3 }),
      }),
    );
  });

  it('aceita produtos sem categoria técnica, como celulares', async () => {
    ofertas([{ imagemUrl: 'https://cdn.test/celular.jpg', criterioIdentidade: 'GTIN' }]);
    await expect(service.buscar({ nome: 'Samsung Galaxy S25', gtin: '7891234567895' })).resolves.toHaveProperty('imagemUrl');
  });

  it('ignora ofertas sem imagem e correspondências sem identidade confirmada', async () => {
    ofertas([null, { urlOriginal: 'https://loja.test/produto', criterioIdentidade: 'GTIN' }, { imagemUrl: 'https://cdn.test/errada.jpg' }, { imagemUrl: 'https://cdn.test/correta.jpg', criterioIdentidade: 'MPN_MARCA' }]);
    await expect(service.buscar(dados)).resolves.toHaveProperty('imagemUrl', 'https://cdn.test/correta.jpg');
    expect(validarUrlPublica).toHaveBeenCalledTimes(1);
  });

  it('descarta imagem interna ou insegura e tenta a próxima loja', async () => {
    jest.mocked(validarUrlPublica).mockRejectedValueOnce(new Error('Rede interna'));
    ofertas([{ imagemUrl: 'http://127.0.0.1/foto', criterioIdentidade: 'GTIN' }, { imagemUrl: 'https://cdn.test/foto.jpg', criterioIdentidade: 'GTIN' }]);
    await expect(service.buscar(dados)).resolves.toHaveProperty('imagemUrl', 'https://cdn.test/foto.jpg');
  });

  it('falha sem retornar o link da página como imagem', async () => {
    ofertas([{ urlOriginal: 'https://loja.test/produto', criterioIdentidade: 'GTIN' }]);
    await expect(service.buscar(dados)).rejects.toThrow('Não encontrei uma imagem válida');
  });

  it('exige identificação forte antes de consultar as lojas', async () => {
    await expect(service.buscar({ nome: 'Placa de vídeo', modelo: ' ' })).rejects.toThrow('modelo, MPN ou GTIN/EAN');
    expect(postProdutoIa).not.toHaveBeenCalled();
  });

  it('informa serviço não configurado', async () => {
    delete process.env.PRODUTO_IA_API_KEY;
    await expect(service.buscar(dados)).rejects.toThrow('não configurado');
  });

  it('informa indisponibilidade da loja e resposta inválida', async () => {
    jest.mocked(postProdutoIa).mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await expect(service.buscar(dados)).rejects.toThrow('Não foi possível consultar');
    jest.mocked(postProdutoIa).mockResolvedValueOnce(new Response('{"ofertas":{}}'));
    await expect(service.buscar(dados)).rejects.toThrow('resposta inválida');
  });

  it('informa o timeout da busca', async () => {
    jest.mocked(postProdutoIa).mockRejectedValue(new DOMException('abort', 'AbortError'));
    await expect(service.buscar(dados)).rejects.toThrow('Tempo esgotado');
  });

  it('valida campos administrativos e remove espaços', async () => {
    const dto = plainToInstance(BuscarImagemProdutoDto, { nome: ' Produto ', modelo: ' RTX 4060 ' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.nome).toBe('Produto');
    expect(dto.modelo).toBe('RTX 4060');
    expect(await validate(plainToInstance(BuscarImagemProdutoDto, { nome: '  ' }))).not.toEqual([]);
  });
});
