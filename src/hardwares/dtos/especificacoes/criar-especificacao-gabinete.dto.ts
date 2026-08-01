import { Type } from 'class-transformer';
import {
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
  alturaMm!: number;

  @IsNumber()
  @Min(1)
  larguraMm!: number;

  @IsNumber()
  @Min(1)
  profundidadeMm!: number;

  @IsArray()
  @ArrayUnique()
  @IsEnum(FormatoPlacaMae, {
    each: true,
    message: 'Informe somente formatos de placa-mãe válidos.',
  })
  formatosPlacaMaeSuportados!: FormatoPlacaMae[];

  @IsArray()
  @ArrayUnique()
  @IsEnum(FormatoFonte, {
    each: true,
    message: 'Informe somente formatos de fonte válidos.',
  })
  formatosFonteSuportados!: FormatoFonte[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  comprimentoMaximoFonteMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comprimentoMaximoGpuMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  alturaMaximaGpuMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  slotsMaximosGpu?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  alturaMaximaCoolerCpuMm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  baias25?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  baias35?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  slotsTraseiros?: number;

  @IsOptional()
  @IsBoolean()
  suportaGpuVertical?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  espacoGerenciamentoCabosMm?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriarSuporteVentoinhaGabineteDto)
  suportesFans?: CriarSuporteVentoinhaGabineteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriarSuporteRadiadorGabineteDto)
  suportesRadiador?: CriarSuporteRadiadorGabineteDto[];
}
