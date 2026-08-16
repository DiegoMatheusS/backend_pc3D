import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  FormatoFonte,
  ModularidadeFonte,
} from '../../../generated/prisma/enums';

export class CriarEspecificacaoFonteDto {
  @IsEnum(FormatoFonte, {
    message: 'Informe um formato de fonte válido.',
  })
  formato!: FormatoFonte;

  @IsInt()
  @Min(1)
  @Max(100_000)
  potenciaWatts!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  certificacao?: string;

  @IsOptional()
  @IsEnum(ModularidadeFonte, {
    message: 'Informe uma modularidade válida.',
  })
  modularidade?: ModularidadeFonte;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  comprimentoMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  larguraMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  alturaMm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  padraoAtx?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  eficienciaPercentual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  correnteLinha12vAmperes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(128)
  conectoresAtx24Pinos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(128)
  conectoresEpsCpu?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(128)
  conectoresPcie6Pinos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(128)
  conectoresPcie8Pinos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(128)
  conectores12vhpwr?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(128)
  conectores12v2x6?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(128)
  conectoresSata?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(128)
  conectoresMolex?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  protecoes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tensaoEntrada?: string;
}
