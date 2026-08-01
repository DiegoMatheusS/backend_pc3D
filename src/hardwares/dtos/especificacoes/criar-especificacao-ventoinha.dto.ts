import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { TipoConectorVentoinha } from '../../../generated/prisma/enums';

export class CriarEspecificacaoVentoinhaDto {
  @IsInt()
  @Min(1)
  tamanhoMm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  espessuraMm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rpmMinima?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  rpmMaxima?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fluxoArCfm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pressaoEstaticaMmH2o?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ruidoDb?: number;

  @IsEnum(TipoConectorVentoinha, {
    message: 'Informe um conector de ventoinha válido.',
  })
  conector!: TipoConectorVentoinha;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tensaoVolts?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  correnteAmperes?: number;

  @IsOptional()
  @IsBoolean()
  pwm?: boolean;

  @IsOptional()
  @IsBoolean()
  rgb?: boolean;

  @IsOptional()
  @IsBoolean()
  argb?: boolean;

  @IsOptional()
  @IsBoolean()
  fluxoReverso?: boolean;
}
