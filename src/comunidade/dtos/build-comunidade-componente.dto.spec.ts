import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';
import { BuildComunidadeComponenteDto } from './build-comunidade-componente.dto';

describe('BuildComunidadeComponenteDto', () => {
  it('descarta URLs locais de preview antes da validação da publicação', () => {
    const dto = plainToInstance(BuildComunidadeComponenteDto, {
      categoria: CategoriaHardware.PLACA_VIDEO,
      nome: 'GPU teste',
      imagemUrl: '/assets/gpu.webp',
      fonteDadosUrl: 'data:text/plain;base64,Zm9v',
      modelo3dUrl: 'blob:https://criabyte.com.br/modelo-local',
    });

    expect(dto.imagemUrl).toBeUndefined();
    expect(dto.fonteDadosUrl).toBeUndefined();
    expect(dto.modelo3dUrl).toBeUndefined();
    expect(validateSync(dto)).toEqual([]);
  });

  it('preserva URLs HTTP/HTTPS públicas válidas', () => {
    const dto = plainToInstance(BuildComunidadeComponenteDto, {
      categoria: CategoriaHardware.GABINETE,
      nome: 'Gabinete teste',
      imagemUrl: 'https://cdn.criabyte.com.br/gabinete.webp',
      fonteDadosUrl: 'https://fabricante.example.com/gabinete',
      modelo3dUrl: 'https://cdn.criabyte.com.br/gabinete.glb',
    });

    expect(dto.imagemUrl).toBe('https://cdn.criabyte.com.br/gabinete.webp');
    expect(dto.fonteDadosUrl).toBe(
      'https://fabricante.example.com/gabinete',
    );
    expect(dto.modelo3dUrl).toBe('https://cdn.criabyte.com.br/gabinete.glb');
    expect(validateSync(dto)).toEqual([]);
  });

  it('continua rejeitando uma URL HTTP/HTTPS malformada', () => {
    const dto = plainToInstance(BuildComunidadeComponenteDto, {
      categoria: CategoriaHardware.PROCESSADOR,
      nome: 'CPU teste',
      imagemUrl: 'https://',
    });

    const erros = validateSync(dto);

    expect(erros.some((erro) => erro.property === 'imagemUrl')).toBe(true);
  });
});
