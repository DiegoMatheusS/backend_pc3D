import 'reflect-metadata';
import { BuildListingAnalysisService } from './build-listing-analysis.service';

describe('pesquisa técnica de computadores pelo ProjetoIA', () => {
  const originalEnv = {
    url: process.env.PRODUTO_IA_URL,
    key: process.env.PRODUTO_IA_API_KEY,
  };
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnv.url === undefined) delete process.env.PRODUTO_IA_URL;
    else process.env.PRODUTO_IA_URL = originalEnv.url;
    if (originalEnv.key === undefined) delete process.env.PRODUTO_IA_API_KEY;
    else process.env.PRODUTO_IA_API_KEY = originalEnv.key;
  });

  it.each([true, false])(
    'transporta pesquisa=%s e a ficha comprovada sem cadastrar peças',
    async (research) => {
      process.env.PRODUTO_IA_URL = 'https://ia.example';
      process.env.PRODUTO_IA_API_KEY = 'test-key';
      const hardware = { findMany: jest.fn().mockResolvedValue([]) };
      const result = {
        componentesDetectados: [
          {
            categoria: 'PROCESSADOR',
            hardwareId: null,
            cadastroHardwareSugerido: {
              nome: 'AMD Ryzen 5 5600G',
              especificacaoProcessador: { nucleos: 6 },
            },
            origemPorCampo: {
              nucleos: { url: 'https://amd.com/cpu', trecho: 'CPU Cores: 6' },
            },
          },
        ],
        nenhumRegistroCriado: true,
      };
      const request = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify(result), { status: 200 }),
        );
      const service = new BuildListingAnalysisService({ hardware } as never);
      const output = await service.analisar({
        titulo: 'Computador Ryzen 5 5600G',
        pesquisarEspecificacoes: research,
      });
      const body = JSON.parse(String(request.mock.calls[0][1]?.body)) as Record<
        string,
        unknown
      >;
      expect(body.pesquisarEspecificacoes).toBe(research);
      expect(output.componentesDetectados).toEqual(
        result.componentesDetectados,
      );
      expect(output.nenhumRegistroCriado).toBe(true);
    },
  );
});
