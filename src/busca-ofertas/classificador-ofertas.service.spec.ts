import { ClassificadorOfertasService } from './classificador-ofertas.service';
import { TagBuscaOferta } from './dtos/filtrar-busca-ofertas.dto';

describe('ClassificadorOfertasService', () => {
  const service = new ClassificadorOfertasService();

  it('classifica GPU, CPU e SSD por regras locais', () => {
    expect(service.classificar('GeForce RTX 5070 ASUS Prime 12GB')).toBe(
      TagBuscaOferta.PLACA_VIDEO,
    );
    expect(service.classificar('AMD Ryzen 7 7800X3D')).toBe(
      TagBuscaOferta.PROCESSADOR,
    );
    expect(service.classificar('Kingston KC3000 NVMe 1TB SSD')).toBe(
      TagBuscaOferta.SSD,
    );
  });

  it('não depende de Gemini para classificar uma fonte', () => {
    expect(service.classificar('Fonte Corsair RM850x 850W ATX')).toBe(
      TagBuscaOferta.FONTE,
    );
  });
});
