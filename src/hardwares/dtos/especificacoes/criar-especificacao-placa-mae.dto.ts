import {
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
import { FormatoPlacaMae, TipoMemoria } from '../../../generated/prisma/enums';
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
  @ArrayUnique()
  @IsEnum(TipoMemoria, {
    each: true,
    message: 'Informe somente tipos de memória válidos.',
  })
  tiposMemoriaSuportados!: TipoMemoria[];

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  frequenciasMemoriaJedecMhz!: number[];

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  frequenciasMemoriaOverclockMhz!: number[];

  @IsInt()
  @Min(1)
  slotsMemoria!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidadeMaximaMemoriaGb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
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

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  saidasVideo!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
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
  @ValidateNested({ each: true })
  @Type(() => CriarSlotM2PlacaMaeDto)
  slotsM2?: CriarSlotM2PlacaMaeDto[];
}
