import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  normalizarNomeTecnico,
  exigirNomeTecnico,
  descricaoTecnica,
} from './catalog-content';
const cases = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'catalog-names.json'), 'utf8'),
) as Array<{
  nome: string;
  esperado: string;
  marca?: string;
  modelo?: string;
  categoria?: string;
}>;
describe('conteúdo técnico do catálogo', () => {
  it.each(cases)('normaliza $nome sem perder SKU ou variante', (item) => {
    expect(normalizarNomeTecnico(item.nome, item)).toBe(item.esperado);
  });
  it('recusa história sem identidade técnica', () => {
    expect(() =>
      exigirNomeTecnico('Conheça a história de nossa empresa.'),
    ).toThrow('nome técnico');
  });
  it('descreve especificações informadas sem criar valores ausentes', () => {
    const text = descricaoTecnica(
      {
        nucleos: 6,
        threads: 12,
        tdpWatts: 65,
        possuiVideoIntegrado: false,
        cacheL3Mb: 0,
      },
      'AMD Ryzen 5',
    );
    expect(text).toContain('65 W');
    expect(text).toContain('Não');
    expect(text).toContain('0 MB');
    expect(text).not.toContain('MHz');
  });
});
