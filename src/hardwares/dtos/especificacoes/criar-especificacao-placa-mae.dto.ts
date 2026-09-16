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
  if (valor === undefined || valor === null) return [];

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

function normalizarFrequenciasMemoria(valor: unknown): number[] {
  if (valor === undefined || valor === null || valor === '') return [];

  const entrada = Array.isArray(valor) ? valor : [valor];
  const resultado = new Set<number>();

  const adicionar = (numero: number) => {
    if (!Number.isInteger(numero)) return;
    // Faixa propositalmente conservadora para DDR3/DDR4/DDR5 e gerações próximas.
    // Valores gigantes normalmente são erro de unidade/parser (ex.: 5.200.000).
    if (numero < 400 || numero > 20_000) return;
    resultado.add(numero);
  };

  for (const item of entrada) {
    if (typeof item === 'number') {
      adicionar(item);
      continue;
    }

    if (typeof item !== 'string') continue;
    const texto = item.trim();
    if (!texto) continue;

    // Aceita tanto "5200, 5600" quanto "DDR5-6000" ou "6000 MT/s".
    const encontrados = texto.match(/\b\d{3,5}\b/g) ?? [];
    for (const encontrado of encontrados) adicionar(Number(encontrado));
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
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsEnum(TipoMemoria, {
    each: true,
    message: 'Informe somente tipos de memória válidos.',
  })
  tiposMemoriaSuportados: TipoMemoria[] = [];

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

  @Transform(({ value }) => normalizarFrequenciasMemoria(value), {
    toClassOnly: true,
  })
  @IsArray()
  @ArrayMaxSize(64)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(400, { each: true })
  @Max(20_000, { each: true })
  frequenciasMemoriaJedecMhz!: number[];

  @Transform(({ value }) => normalizarFrequenciasMemoria(value), {
    toClassOnly: true,
  })
  @IsArray()
  @ArrayMaxSize(64)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(400, { each: true })
  @Max(20_000, { each: true })
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
