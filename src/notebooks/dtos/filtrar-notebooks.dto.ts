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

export class FiltrarNotebooksDto {
  @IsOptional() @IsString() @MaxLength(100) marca?: string;
  @IsOptional() @IsString() @MaxLength(150) processador?: string;
  @IsOptional() @IsString() @MaxLength(150) gpu?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(4096) ramMin?: number;
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
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  telaMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) hzMin?: number;
  @IsOptional() @IsString() @MaxLength(200) busca?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINA_MAXIMA)
  pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
}
