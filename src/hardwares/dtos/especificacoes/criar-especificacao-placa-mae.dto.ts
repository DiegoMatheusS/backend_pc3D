import {
  Max,
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  FormatoMemoria,
  FormatoPlacaMae,
  TipoMemoria,
} from '../../../generated/prisma/enums';
import { Type } from 'class-transformer';
import { CriarSlotM2PlacaMaeDto } from './criar-slot-m2-placa-mae.dto';

export class CriarEspecificacaoPlacaMaeDto {
  @IsString()
  @MaxLength(50)
  socket!: string;

  @IsString()
  @MaxLength(100)
  chipset!: string;

  @IsEnum(FormatoPlacaMae, {
    message: 'Informe um formato de placa-mãe válido.',
  })
  formato!: FormatoPlacaMae;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  revisao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  biosInicial?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsEnum(TipoMemoria, {
    each: true,
    message: 'Informe somente tipos de memória válidos.',
  })
  tiposMemoriaSuportados!: TipoMemoria[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsEnum(FormatoMemoria, {
    each: true,
    message: 'Informe somente formatos de memória válidos.',
  })
  formatosMemoriaSuportados?: FormatoMemoria[];

  @IsArray()
  @ArrayMaxSize(64)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(1_000_000, { each: true })
  frequenciasMemoriaJedecMhz!: number[];

  @IsArray()
  @ArrayMaxSize(64)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(1_000_000, { each: true })
  frequenciasMemoriaOverclockMhz!: number[];

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  slotsMemoria!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacidadeMaximaMemoriaGb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacidadeMaximaPorSlotGb?: number;

  @IsOptional()
  @IsBoolean()
  suportaXmp?: boolean;

  @IsOptional()
  @IsBoolean()
  suportaExpo?: boolean;

  @IsOptional()
  @IsBoolean()
  suportaEcc?: boolean;

  @IsOptional()
  @IsBoolean()
  suportaMemoriaRegistrada?: boolean;

  @IsArray()
  @ArrayMaxSize(32)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  saidasVideo!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  portasSata?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  versaoPcie?: string;

  @IsOptional()
  @IsBoolean()
  wifi?: boolean;

  @IsOptional()
  @IsBoolean()
  bluetooth?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ethernet?: string;

  @IsOptional()
  @IsBoolean()
  biosFlashback?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  biosMinima?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => CriarSlotM2PlacaMaeDto)
  slotsM2?: CriarSlotM2PlacaMaeDto[];
}
