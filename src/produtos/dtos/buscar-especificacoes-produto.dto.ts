import { IsBoolean, IsOptional } from 'class-validator';

export class BuscarEspecificacoesProdutoDto {
  @IsOptional()
  @IsBoolean()
  usarIa?: boolean;
}
