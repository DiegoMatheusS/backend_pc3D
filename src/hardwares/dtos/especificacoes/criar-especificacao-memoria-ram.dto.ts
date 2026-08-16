import {
  Max,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { FormatoMemoria, TipoMemoria } from '../../../generated/prisma/enums';

export class CriarEspecificacaoMemoriaRamDto {
  @IsEnum(TipoMemoria, {
    message: 'Informe um tipo de memória válido.',
  })
  tipo!: TipoMemoria;

  @IsEnum(FormatoMemoria, {
    message: 'Informe um formato de memória válido.',
  })
  formato!: FormatoMemoria;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacidadePorModuloGb!: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantidadeModulos!: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  frequenciaMhz!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  frequenciaJedecMhz?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  latenciaCl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  tensaoVolts?: number;

  @IsOptional()
  @IsBoolean()
  ecc?: boolean;

  @IsOptional()
  @IsBoolean()
  registrada?: boolean;

  @IsOptional()
  @IsBoolean()
  suportaXmp?: boolean;

  @IsOptional()
  @IsBoolean()
  suportaExpo?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  alturaMm?: number;

  @IsOptional()
  @IsBoolean()
  rgb?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  consumoWatts?: number;
}
