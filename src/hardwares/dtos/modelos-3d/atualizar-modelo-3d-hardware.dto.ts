import {
  Max,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsSafeResourceUrl } from '../../../common/validators/is-safe-resource-url.validator';
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
  @IsSafeResourceUrl()
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
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
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
  @Max(1_000_000)
  alturaRealMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  larguraRealMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  profundidadeRealMm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  tamanhoBytes?: number | null;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoCorrecaoX?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoCorrecaoY?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoCorrecaoZ?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoCorrecaoX?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoCorrecaoY?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoCorrecaoZ?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaCorrecaoX?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaCorrecaoY?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaCorrecaoZ?: number;
}
