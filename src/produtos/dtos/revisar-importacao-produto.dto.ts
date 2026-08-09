import { Max, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class RevisarImportacaoProdutoDto {
  @IsBoolean()
  aprovada!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  produtoId?: number;
}
