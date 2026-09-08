import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoMemoria } from '../../../generated/prisma/enums';

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

export class CriarEspecificacaoProcessadorDto {
  @IsString()
  @MaxLength(50)
  socket!: string;

  @IsOptional() @IsString() @MaxLength(100) familia?: string;
  @IsOptional() @IsString() @MaxLength(100) linha?: string;
  @IsOptional() @IsString() @MaxLength(100) geracao?: string;
  @IsOptional() @IsString() @MaxLength(100) arquitetura?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000) litografiaNm?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) nucleos?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) threads?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) frequenciaBaseMhz?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) frequenciaTurboMhz?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000) cacheL2Mb?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000) cacheL3Mb?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100_000) tdpWatts?: number;
  @IsOptional() @IsBoolean() possuiVideoIntegrado?: boolean;
  @IsOptional() @IsString() @MaxLength(150) modeloVideoIntegrado?: string;

  @Transform(({ value }) => normalizarTiposMemoria(value), {
    toClassOnly: true,
  })
  @IsArray()
  @ArrayMaxSize(16)
  @IsEnum(TipoMemoria, { each: true })
  tiposMemoriaSuportados: TipoMemoria[] = [];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  frequenciaMemoriaMaximaMhz?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacidadeMemoriaMaximaGb?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) canaisMemoria?: number;
  @IsOptional() @IsBoolean() suportaEcc?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000) temperaturaMaximaC?: number;
  @IsOptional() @IsString() @MaxLength(20) versaoPcie?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) lanesPcie?: number;
  @IsOptional() @IsBoolean() coolerIncluso?: boolean;
  @IsOptional() @IsBoolean() multiplicadorDesbloqueado?: boolean;
  @IsOptional() @IsBoolean() suporteOverclock?: boolean;
  @IsOptional() @IsDateString() dataLancamento?: string;
}
