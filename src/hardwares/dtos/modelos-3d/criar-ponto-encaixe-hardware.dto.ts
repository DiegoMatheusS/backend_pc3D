import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CategoriaHardware } from '../../../generated/prisma/enums';

export class CriarPontoEncaixeHardwareDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  codigo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string;

  @IsEnum(CategoriaHardware)
  categoriaAceita!: CategoriaHardware;

  @IsOptional()
  @IsNumber()
  posicaoX?: number;

  @IsOptional()
  @IsNumber()
  posicaoY?: number;

  @IsOptional()
  @IsNumber()
  posicaoZ?: number;

  @IsOptional()
  @IsNumber()
  rotacaoX?: number;

  @IsOptional()
  @IsNumber()
  rotacaoY?: number;

  @IsOptional()
  @IsNumber()
  rotacaoZ?: number;

  @IsOptional()
  @IsNumber()
  escalaX?: number;

  @IsOptional()
  @IsNumber()
  escalaY?: number;

  @IsOptional()
  @IsNumber()
  escalaZ?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  obrigatorio?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsString()
  observacao?: string;
}
