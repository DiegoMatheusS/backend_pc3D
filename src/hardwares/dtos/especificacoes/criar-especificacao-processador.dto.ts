import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoMemoria } from '../../../generated/prisma/enums';

export class CriarEspecificacaoProcessadorDto {
  @IsString()
  @MaxLength(50)
  socket!: string;

  @IsOptional() @IsString() @MaxLength(100) familia?: string;
  @IsOptional() @IsString() @MaxLength(100) linha?: string;
  @IsOptional() @IsString() @MaxLength(100) geracao?: string;
  @IsOptional() @IsString() @MaxLength(100) arquitetura?: string;
  @IsOptional() @IsNumber() @Min(0) litografiaNm?: number;
  @IsOptional() @IsInt() @Min(1) nucleos?: number;
  @IsOptional() @IsInt() @Min(1) threads?: number;
  @IsOptional() @IsInt() @Min(1) frequenciaBaseMhz?: number;
  @IsOptional() @IsInt() @Min(1) frequenciaTurboMhz?: number;
  @IsOptional() @IsNumber() @Min(0) cacheL2Mb?: number;
  @IsOptional() @IsNumber() @Min(0) cacheL3Mb?: number;
  @IsOptional() @IsInt() @Min(1) tdpWatts?: number;
  @IsOptional() @IsBoolean() possuiVideoIntegrado?: boolean;
  @IsOptional() @IsString() @MaxLength(150) modeloVideoIntegrado?: string;

  @IsArray()
  @IsEnum(TipoMemoria, { each: true })
  tiposMemoriaSuportados!: TipoMemoria[];

  @IsOptional() @IsInt() @Min(1) frequenciaMemoriaMaximaMhz?: number;
  @IsOptional() @IsInt() @Min(1) capacidadeMemoriaMaximaGb?: number;
  @IsOptional() @IsInt() @Min(1) canaisMemoria?: number;
  @IsOptional() @IsBoolean() suportaEcc?: boolean;
  @IsOptional() @IsNumber() @Min(0) temperaturaMaximaC?: number;
  @IsOptional() @IsString() @MaxLength(20) versaoPcie?: string;
  @IsOptional() @IsInt() @Min(0) lanesPcie?: number;
  @IsOptional() @IsBoolean() coolerIncluso?: boolean;
  @IsOptional() @IsBoolean() multiplicadorDesbloqueado?: boolean;
  @IsOptional() @IsBoolean() suporteOverclock?: boolean;
  @IsOptional() @IsDateString() dataLancamento?: string;
}
