import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { GrupoCategoriaProduto } from '../../generated/prisma/enums';

export class AtualizarCategoriaProdutoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  slug?: string;

  @IsOptional()
  @IsEnum(GrupoCategoriaProduto)
  grupo?: GrupoCategoriaProduto;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}
