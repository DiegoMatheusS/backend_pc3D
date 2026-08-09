import {
  Max,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CategoriaHardware } from '../../../generated/prisma/enums';

export class AtualizarPontoEncaixeHardwareDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string;

  @IsOptional()
  @IsEnum(CategoriaHardware)
  categoriaAceita?: CategoriaHardware;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoX?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoY?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoZ?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoX?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoY?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoZ?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaX?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaY?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaZ?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  obrigatorio?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;
}
