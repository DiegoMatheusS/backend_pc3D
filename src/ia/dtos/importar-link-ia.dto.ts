import { IsIn, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { CATEGORIAS_IMPORTACAO_IA } from './categoria-importacao-ia';
import type { CategoriaImportacaoIa } from './categoria-importacao-ia';

export class ImportarLinkIaDto {
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  url!: string;

  /**
   * O ADMIN pode escolher o destino antes de importar. A escolha é preservada:
   * a IA não troca NOTEBOOK por PROCESSADOR só porque o anúncio cita a CPU.
   */
  @IsOptional()
  @IsIn(CATEGORIAS_IMPORTACAO_IA)
  categoriaEsperada?: CategoriaImportacaoIa;
}
