import { Type } from 'class-transformer';
import {
  Max,
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  FormatoFonte,
  FormatoPlacaMae,
  TamanhoGabinete,
} from '../../../generated/prisma/enums';
import { CriarSuporteRadiadorGabineteDto } from './criar-suporte-radiador-gabinete.dto';
import { CriarSuporteVentoinhaGabineteDto } from './criar-suporte-ventoinha-gabinete.dto';

export class CriarEspecificacaoGabineteDto {
  @IsEnum(TamanhoGabinete, {
    message: 'Informe um tamanho de gabinete válido.',
  })
  tamanho!: TamanhoGabinete;

  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  alturaMm!: number;

  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  larguraMm!: number;

  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  profundidadeMm!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsEnum(FormatoPlacaMae, {
    each: true,
    message: 'Informe somente formatos de placa-mãe válidos.',
  })
  formatosPlacaMaeSuportados!: FormatoPlacaMae[];

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsEnum(FormatoFonte, {
    each: true,
    message: 'Informe somente formatos de fonte válidos.',
  })
  formatosFonteSuportados!: FormatoFonte[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  comprimentoMaximoFonteMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  comprimentoMaximoGpuMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  alturaMaximaGpuMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  slotsMaximosGpu?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  alturaMaximaCoolerCpuMm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  baias25?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  baias35?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  slotsTraseiros?: number;

  @IsOptional()
  @IsBoolean()
  suportaGpuVertical?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  espacoGerenciamentoCabosMm?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => CriarSuporteVentoinhaGabineteDto)
  suportesFans?: CriarSuporteVentoinhaGabineteDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => CriarSuporteRadiadorGabineteDto)
  suportesRadiador?: CriarSuporteRadiadorGabineteDto[];
}
