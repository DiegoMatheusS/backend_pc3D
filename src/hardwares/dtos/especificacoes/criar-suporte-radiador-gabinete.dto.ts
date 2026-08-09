import {
  Max,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PosicaoRefrigeracaoGabinete } from '../../../generated/prisma/enums';

export class CriarSuporteRadiadorGabineteDto {
  @IsEnum(PosicaoRefrigeracaoGabinete, {
    message: 'Informe uma posição de radiador válida.',
  })
  posicao!: PosicaoRefrigeracaoGabinete;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  tamanhoMm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  espessuraConjuntoMaximaMm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;
}
