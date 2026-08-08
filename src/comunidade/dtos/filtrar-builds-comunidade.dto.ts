import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum OrdenacaoBuildComunidade {
  RECENTES = 'RECENTES',
  MAIS_COPIADAS = 'MAIS_COPIADAS',
}

export class FiltrarBuildsComunidadeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  busca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  finalidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  resolucao?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  processador?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gpu?: number;

  @IsOptional()
  @IsEnum(OrdenacaoBuildComunidade)
  ordenar?: OrdenacaoBuildComunidade;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite?: number;
}
