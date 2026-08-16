import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const PRECO_MAXIMO_FILTRO = 100_000_000;
const PAGINA_MAXIMA = 100_000;

export class FiltrarBuildsDto {
  @IsOptional() @IsString() @MaxLength(150) uso?: string;
  @IsOptional() @IsString() @MaxLength(80) resolucao?: string;
  @IsOptional() @IsString() @MaxLength(100) categoria?: string;
  @IsOptional() @IsString() @MaxLength(200) busca?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(PRECO_MAXIMO_FILTRO)
  precoMin?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(PRECO_MAXIMO_FILTRO)
  precoMax?: number;
  @IsOptional() @IsString() @MaxLength(150) parceiro?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINA_MAXIMA)
  pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
}
