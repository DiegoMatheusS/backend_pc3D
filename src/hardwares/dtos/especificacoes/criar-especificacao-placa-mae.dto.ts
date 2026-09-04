import { Transform, Type } from 'class-transformer';
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
import { CriarSlotM2PlacaMaeDto } from './criar-slot-m2-placa-mae.dto';

function normalizarTiposMemoria(valor: unknown): unknown {
  if (valor === undefined || valor === null) return valor;

  const entrada = Array.isArray(valor) ? valor : [valor];
  const resultado = new Set<string>();

  for (const item of entrada) {
    if (typeof item !== 'string') continue;

    const texto = item.trim().toUpperCase();
    if (!texto) continue;

    /*
     * Extrai somente os enums aceitos pelo backend.
     *
     * Exemplos:
     * DDR4                  -> DDR4
     * ddr5                 -> DDR5
     * DDR 4                -> DDR4
     * DDR4-3200            -> DDR4
     * DDR5/DDR4            -> DDR5 + DDR4
     * DDR5 / LPDDR5        -> DDR5
     * DDR4 + DDR5          -> DDR4 + DDR5
     *
     * LPDDR, GDDR, DDR2, DDR6 e outros valores não reconhecidos
     * são ignorados em vez de serem enviados ao @IsEnum.
     */
    const encontrados =
      texto.match(/\bDDR\s*[-_]?\s*[345](?=$|[^A-Z0-9])/g) ?? [];

    for (const encontrado of encontrados) {
      const normalizado = encontrado.replace(/[\s_-]/g, '');
      resultado.add(normalizado);
    }
  }

  return [...resultado];
}

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

  @Transform(({ value }) => normalizarTiposMemoria(value), {
    toClassOnly: true,
  })
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
