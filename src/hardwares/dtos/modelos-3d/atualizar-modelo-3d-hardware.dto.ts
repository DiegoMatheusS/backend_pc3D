import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  FormatoModelo3D,
  OrigemModelo3D,
} from '../../../generated/prisma/enums';

export class AtualizarModelo3DHardwareDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string | null;

  // Campo obrigatório no banco: pode ser omitido no PATCH, mas não pode virar null.
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsString()
  @MaxLength(500)
  arquivoUrl?: string;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsEnum(FormatoModelo3D)
  formato?: FormatoModelo3D;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsEnum(OrigemModelo3D)
  origem?: OrigemModelo3D;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fonteUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  autor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  licenca?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  versao?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  alturaRealMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  larguraRealMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  profundidadeRealMm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  tamanhoBytes?: number | null;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  posicaoCorrecaoX?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  posicaoCorrecaoY?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  posicaoCorrecaoZ?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  rotacaoCorrecaoX?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  rotacaoCorrecaoY?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  rotacaoCorrecaoZ?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  escalaCorrecaoX?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  escalaCorrecaoY?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  escalaCorrecaoZ?: number;
}
