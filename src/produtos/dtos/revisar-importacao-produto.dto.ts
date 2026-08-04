import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class RevisarImportacaoProdutoDto {
  @IsBoolean()
  aprovada!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  produtoId?: number;
}
