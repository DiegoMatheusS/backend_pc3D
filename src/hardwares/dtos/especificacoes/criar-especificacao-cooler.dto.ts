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
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoCooler } from '../../../generated/prisma/enums';

export class CriarEspecificacaoCoolerDto {
  @IsEnum(TipoCooler, {
    message: 'Informe um tipo de cooler válido.',
  })
  tipo!: TipoCooler;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(32)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  socketsSuportados!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacidadeTermicaWatts?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  alturaMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  larguraMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  profundidadeMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  alturaLivreRamMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  tamanhoRadiadorMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  espessuraRadiadorMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantidadeVentoinhas?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  tamanhoVentoinhaMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  espessuraVentoinhaMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  comprimentoMangueirasMm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  conectorBomba?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  consumoBombaWatts?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  consumoWatts?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000)
  ruidoDb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  vidaUtilHoras?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  pesoGramas?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  velocidadeMaxRpm?: number;

  @IsOptional()
  @IsBoolean()
  rgb?: boolean;

  @IsOptional()
  @IsBoolean()
  argb?: boolean;
}
