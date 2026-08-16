import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UsoPC } from './chat-ia.dto';

export class MontarPcIaDto {
  @IsNumber()
  @IsPositive()
  @Max(100_000_000)
<<<<<<< HEAD
  orcamento!: number;
=======
  orcamento: number;
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c

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
  @Max(2_147_483_647)
  gabineteId?: number;

  /**
   * ID da fonte para o cálculo de consumo.
   * Obrigatório para validação completa de compatibilidade.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  fonteId?: number;
}
