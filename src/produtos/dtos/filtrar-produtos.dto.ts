import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { GrupoCategoriaProduto } from '../../generated/prisma/enums';

const PRECO_MAXIMO_FILTRO = 100_000_000;
const PAGINA_MAXIMA = 100_000;

function transformarBooleano({ value }: { value: unknown }): unknown {
  const valor = value;
  if (valor === true || valor === 'true') return true;
  if (valor === false || valor === 'false') return false;
  return valor;
}

export class FiltrarProdutosDto {
  @IsOptional() @IsString() @MaxLength(140) categoria?: string;
  @IsOptional() @IsEnum(GrupoCategoriaProduto) grupo?: GrupoCategoriaProduto;
  @IsOptional() @IsString() @MaxLength(100) marca?: string;
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
  @Transform(transformarBooleano)
  @IsBoolean()
  comOferta?: boolean;

  // Monitor
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  telaMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) hzMin?: number;
  @IsOptional() @IsString() @MaxLength(50) resolucao?: string;
  @IsOptional() @IsString() @MaxLength(50) painel?: string;

  // Mouse
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  dpiMin?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  pollingRateMin?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100_000)
  pesoMax?: number;

  // Teclado
  @IsOptional() @IsString() @MaxLength(100) switch?: string;
  @IsOptional() @IsString() @MaxLength(80) layout?: string;

  // Headset
  @IsOptional()
  @Transform(transformarBooleano)
  @IsBoolean()
  wireless?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  bateriaMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINA_MAXIMA)
  pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
}
