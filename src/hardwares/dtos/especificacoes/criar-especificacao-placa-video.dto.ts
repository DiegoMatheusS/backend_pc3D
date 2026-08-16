import {
  Max,
  ArrayMaxSize,
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
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) memoriaVideoGb?: number;
  @IsOptional() @IsString() @MaxLength(50) tipoMemoriaVideo?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) barramentoBits?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) clockBaseMhz?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) clockBoostMhz?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) geracaoPcie?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) larguraPcie?: number;
  @IsNumber() @Min(1) @Max(1_000_000) comprimentoMm!: number;
  @IsOptional() @IsNumber() @Min(1) @Max(1_000_000) alturaMm?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(1_000_000) espessuraMm?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(1_000_000) slotsOcupados?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) consumoWatts?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  potenciaFonteRecomendadaWatts?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) conectoresPcie6Pinos?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) conectoresPcie8Pinos?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) conectores12vhpwr?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) conectores12v2x6?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  saidasVideo?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) hdmi?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) displayPort?: number;
}
