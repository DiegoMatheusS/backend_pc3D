import {
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
  comprimentoMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  larguraMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
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
  correnteLinha12vAmperes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  conectoresAtx24Pinos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  conectoresEpsCpu?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  conectoresPcie6Pinos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  conectoresPcie8Pinos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  conectores12vhpwr?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  conectores12v2x6?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  conectoresSata?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  conectoresMolex?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  protecoes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tensaoEntrada?: string;
}
