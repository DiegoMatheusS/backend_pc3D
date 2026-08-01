import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoMemoria } from '../../../generated/prisma/enums';

export class CriarEspecificacaoProcessadorDto {
  @IsString({
    message: 'O socket do processador deve ser um texto.',
  })
  @MaxLength(50, {
    message: 'O socket deve ter no máximo 50 caracteres.',
  })
  socket!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  familia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  linha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  geracao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  arquitetura?: string;

  @IsOptional()
  @IsInt({
    message: 'A quantidade de núcleos deve ser um número inteiro.',
  })
  @Min(1)
  nucleos?: number;

  @IsOptional()
  @IsInt({
    message: 'A quantidade de threads deve ser um número inteiro.',
  })
  @Min(1)
  threads?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  frequenciaBaseMhz?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  frequenciaTurboMhz?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  tdpWatts?: number;

  @IsOptional()
  @IsBoolean()
  possuiVideoIntegrado?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  modeloVideoIntegrado?: string;

  @IsArray({
    message: 'Os tipos de memória suportados devem ser uma lista.',
  })
  @IsEnum(TipoMemoria, {
    each: true,
    message: 'Informe somente tipos de memória válidos.',
  })
  tiposMemoriaSuportados!: TipoMemoria[];

  @IsOptional()
  @IsInt()
  @Min(1)
  frequenciaMemoriaMaximaMhz?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidadeMemoriaMaximaGb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  canaisMemoria?: number;

  @IsOptional()
  @IsBoolean()
  suportaEcc?: boolean;
}
