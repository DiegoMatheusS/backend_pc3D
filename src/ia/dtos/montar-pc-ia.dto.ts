import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { UsoPC } from './chat-ia.dto';

export class MontarPcIaDto {
  @IsNumber()
  @IsPositive()
  orcamento: number;

  @IsOptional()
  @IsEnum(UsoPC)
  uso?: UsoPC;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  resolucao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferencia?: string;

  /**
   * Quando informado, o backend valida a build sugerida pela IA
   * usando o sistema real de compatibilidade.
   * Deve ser o ID de um gabinete publicado.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  gabineteId?: number;

  /**
   * ID da fonte para o cálculo de consumo.
   * Obrigatório para validação completa de compatibilidade.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  fonteId?: number;
}
