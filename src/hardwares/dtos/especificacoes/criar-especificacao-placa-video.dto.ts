import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarEspecificacaoPlacaVideoDto {
  @IsOptional() @IsString() @MaxLength(150) chipset?: string;
  @IsOptional() @IsString() @MaxLength(150) gpu?: string;
  @IsOptional() @IsString() @MaxLength(100) arquitetura?: string;
  @IsOptional() @IsInt() @Min(1) memoriaVideoGb?: number;
  @IsOptional() @IsString() @MaxLength(50) tipoMemoriaVideo?: string;
  @IsOptional() @IsInt() @Min(1) barramentoBits?: number;
  @IsOptional() @IsInt() @Min(1) clockBaseMhz?: number;
  @IsOptional() @IsInt() @Min(1) clockBoostMhz?: number;
  @IsOptional() @IsInt() @Min(1) geracaoPcie?: number;
  @IsOptional() @IsInt() @Min(1) larguraPcie?: number;
  @IsNumber() @Min(1) comprimentoMm!: number;
  @IsOptional() @IsNumber() @Min(1) alturaMm?: number;
  @IsOptional() @IsNumber() @Min(1) espessuraMm?: number;
  @IsOptional() @IsNumber() @Min(1) slotsOcupados?: number;
  @IsOptional() @IsInt() @Min(1) consumoWatts?: number;
  @IsOptional() @IsInt() @Min(1) potenciaFonteRecomendadaWatts?: number;
  @IsOptional() @IsInt() @Min(0) conectoresPcie6Pinos?: number;
  @IsOptional() @IsInt() @Min(0) conectoresPcie8Pinos?: number;
  @IsOptional() @IsInt() @Min(0) conectores12vhpwr?: number;
  @IsOptional() @IsInt() @Min(0) conectores12v2x6?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) saidasVideo?: string[];
  @IsOptional() @IsInt() @Min(0) hdmi?: number;
  @IsOptional() @IsInt() @Min(0) displayPort?: number;
}
