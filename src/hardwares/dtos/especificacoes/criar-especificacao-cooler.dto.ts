import {
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
  @ArrayUnique()
  @IsString({ each: true })
  socketsSuportados!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidadeTermicaWatts?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  alturaMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  larguraMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  profundidadeMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  alturaLivreRamMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  tamanhoRadiadorMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  espessuraRadiadorMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeVentoinhas?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  tamanhoVentoinhaMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  espessuraVentoinhaMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comprimentoMangueirasMm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  conectorBomba?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consumoBombaWatts?: number;

  @IsOptional()
  @IsBoolean()
  rgb?: boolean;

  @IsOptional()
  @IsBoolean()
  argb?: boolean;
}
