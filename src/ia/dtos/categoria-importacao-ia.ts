import { CategoriaHardware } from '../../generated/prisma/enums';

export const CATEGORIAS_IMPORTACAO_IA = [
  ...Object.values(CategoriaHardware),
  'NOTEBOOK',
  'PC_MONTADO',
  'CELULAR',
] as const;

export type CategoriaImportacaoIa = (typeof CATEGORIAS_IMPORTACAO_IA)[number];

export function ehCategoriaHardwareImportacao(
  valor: string | null | undefined,
): valor is CategoriaHardware {
  return Object.values(CategoriaHardware).includes(valor as CategoriaHardware);
}
