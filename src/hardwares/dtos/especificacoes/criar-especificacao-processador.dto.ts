import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
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
  if (valor === undefined || valor === null) return valor;

  const entrada = Array.isArray(valor) ? valor : [valor];
  const resultado: unknown[] = [];

  for (const item of entrada) {
    if (typeof item !== 'string') {
      resultado.push(item);
      continue;
    }

    const texto = item.trim().toUpperCase();

    if (!texto) {
      resultado.push(texto);
      continue;
    }

    // Não converte outros padrões de memória em DDR por engano.
    if (/\b(?:LPDDR|GDDR)\s*[-_]?\s*\d/.test(texto)) {
      resultado.push(texto);
      continue;
    }

    const encontrados = [
      ...texto.matchAll(/\bDDR\s*[-_]?\s*(\d+)(?=$|[^A-Z0-9])/g),
    ];

    if (encontrados.length === 0) {
      resultado.push(texto);
      continue;
    }

    // Se houver uma geração DDR fora do enum atual, mantém o valor inválido
    // para que o class-validator rejeite em vez de perder informação.
    if (
      encontrados.some((match) => !['3', '4', '5'].includes(match[1] ?? ''))
    ) {
      resultado.push(texto);
      continue;
    }

    for (const match of encontrados) {
      resultado.push(`DDR${match[1]}`);
    }
  }

  return [...new Set(resultado)];
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
  @ArrayNotEmpty()
  @ArrayMaxSize(16)
  @IsEnum(TipoMemoria, { each: true })
  tiposMemoriaSuportados!: TipoMemoria[];

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
