import { CategoriaHardware } from '../generated/prisma/enums';
import { HardwaresDescobertaIaService } from './hardwares-descoberta-ia.service';

describe('HardwaresDescobertaIaService - IA técnica', () => {
  it('preserva o payload normalizado devolvido pelo ProjetoIA', async () => {
    const produtoIa = {
      enriquecerIaTecnica: jest.fn().mockResolvedValue({
        utilizado: true,
        provedor: 'OPENAI',
        categoria: CategoriaHardware.PLACA_MAE,
        coberturaAntes: 0.7,
        coberturaDepois: 0.9,
        camposPreenchidos: ['frequenciasMemoriaJedecMhz'],
        camposAusentes: [],
        statusFicha: 'PRONTO',
        payload: {
          nome: 'ASUS PRIME B650-PLUS WIFI',
          marca: 'ASUS',
          modelo: 'PRIME B650-PLUS WIFI',
          categoria: CategoriaHardware.PLACA_MAE,
          especificacaoPlacaMae: {
            socket: 'AM5',
            chipset: 'B650',
            formato: 'ATX',
            frequenciasMemoriaJedecMhz: [5200, 5600],
          },
        },
      }),
    };

    const service = new HardwaresDescobertaIaService(
      {} as never,
      produtoIa as never,
      {} as never,
    );

    const resultado = await service.enriquecerIaTecnica({
      provedor: 'OPENAI',
      categoria: CategoriaHardware.PLACA_MAE,
      nome: 'ASUS PRIME B650-PLUS WIFI',
      somentePreencheLacunas: true,
      payload: {
        nome: 'ASUS PRIME B650-PLUS WIFI',
        marca: 'ASUS',
        modelo: 'PRIME B650-PLUS WIFI',
        categoria: CategoriaHardware.PLACA_MAE,
        especificacaoPlacaMae: {
          socket: 'AM5',
          chipset: 'B650',
          formato: 'ATX',
          frequenciasMemoriaJedecMhz: [5_200_000],
        },
      },
    });

    expect(resultado.payload).toMatchObject({
      especificacaoPlacaMae: {
        frequenciasMemoriaJedecMhz: [5200, 5600],
      },
    });
    expect(produtoIa.enriquecerIaTecnica).toHaveBeenCalledTimes(1);
  });
});
