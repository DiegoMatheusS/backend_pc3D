import 'reflect-metadata';
import type { Request } from 'express';
import { IaAdminController } from './ia-admin.controller';
import { postProdutoIa } from './produto-ia-http';

jest.mock('./produto-ia-http', () => ({ postProdutoIa: jest.fn() }));

describe('detalhes de página na importação administrativa', () => {
  const originalUrl = process.env.PRODUTO_IA_URL;
  const originalKey = process.env.PRODUTO_IA_API_KEY;
  afterEach(() => {
    jest.resetAllMocks();
    if (originalUrl === undefined) delete process.env.PRODUTO_IA_URL;
    else process.env.PRODUTO_IA_URL = originalUrl;
    if (originalKey === undefined) delete process.env.PRODUTO_IA_API_KEY;
    else process.env.PRODUTO_IA_API_KEY = originalKey;
  });

  function setup(resultado: object) {
    process.env.PRODUTO_IA_URL = 'https://ia.example.test';
    process.env.PRODUTO_IA_API_KEY = 'test';
    const ia = { importarLinkAdmin: jest.fn().mockResolvedValue(resultado) };
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    return new IaAdminController(ia as never, auditoria as never);
  }

  it('não repete o scraping já executado pela Produto IA', async () => {
    const resultado = {
      normalizacao: { camposNormalizados: { nome: 'PC Gamer' } },
      resultadoProdutoIa: {
        politicaColeta: { scrapingComplementarExecutado: true },
      },
    };
    const controller = setup(resultado);
    const result = await controller.importarLink(
      { url: 'https://shopee.com.br/product/123/456' },
      null,
      { ip: '127.0.0.1' } as Request,
    );
    expect(result).toBe(resultado);
    expect(postProdutoIa).not.toHaveBeenCalled();
  });

  it('mantém o complemento de descrição quando a API Python antiga não informa a coleta', async () => {
    const controller = setup({
      normalizacao: { camposNormalizados: { nome: 'PC Gamer' } },
    });
    jest.mocked(postProdutoIa).mockResolvedValue(
      new Response(
        JSON.stringify({
          detalhesPagina: { ok: true, descricao: 'Ryzen 5 e 16 GB DDR4' },
        }),
        { status: 200 },
      ),
    );
    const result = await controller.importarLink(
      { url: 'https://shopee.com.br/product/123/456' },
      null,
      { ip: '127.0.0.1' } as Request,
    );
    expect(result).toMatchObject({
      normalizacao: {
        camposNormalizados: {
          nome: 'PC Gamer',
          descricao: 'Ryzen 5 e 16 GB DDR4',
        },
      },
    });
    expect(postProdutoIa).toHaveBeenCalledTimes(1);
  });
});
