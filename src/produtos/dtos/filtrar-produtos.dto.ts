import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { GrupoCategoriaProduto } from '../../generated/prisma/enums';

export class FiltrarProdutosDto {
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsEnum(GrupoCategoriaProduto) grupo?: GrupoCategoriaProduto;
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsString() busca?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) precoMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) precoMax?: number;
  @IsOptional() @IsString() parceiro?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  comOferta?: boolean;

  // Monitor
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) telaMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) hzMin?: number;
  @IsOptional() @IsString() resolucao?: string;
  @IsOptional() @IsString() painel?: string;

  // Mouse
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) dpiMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pollingRateMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) pesoMax?: number;

  // Teclado
  @IsOptional() @IsString() switch?: string;
  @IsOptional() @IsString() layout?: string;

  // Headset
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  wireless?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) bateriaMin?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
}
