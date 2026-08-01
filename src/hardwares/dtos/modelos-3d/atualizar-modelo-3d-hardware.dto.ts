import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { FormatoModelo3D } from '../../../generated/prisma/enums';

export class AtualizarModelo3DHardwareDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  arquivoUrl?: string;

  @IsOptional()
  @IsEnum(FormatoModelo3D)
  formato?: FormatoModelo3D;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  versao?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  alturaRealMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  larguraRealMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  profundidadeRealMm?: number;

  @IsOptional()
  @IsNumber()
  posicaoCorrecaoX?: number;

  @IsOptional()
  @IsNumber()
  posicaoCorrecaoY?: number;

  @IsOptional()
  @IsNumber()
  posicaoCorrecaoZ?: number;

  @IsOptional()
  @IsNumber()
  rotacaoCorrecaoX?: number;

  @IsOptional()
  @IsNumber()
  rotacaoCorrecaoY?: number;

  @IsOptional()
  @IsNumber()
  rotacaoCorrecaoZ?: number;

  @IsOptional()
  @IsNumber()
  escalaCorrecaoX?: number;

  @IsOptional()
  @IsNumber()
  escalaCorrecaoY?: number;

  @IsOptional()
  @IsNumber()
  escalaCorrecaoZ?: number;
}
