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

export class CriarSuporteVentoinhaGabineteDto {
  @IsEnum(PosicaoRefrigeracaoGabinete, {
    message: 'Informe uma posição de ventoinha válida.',
  })
  posicao!: PosicaoRefrigeracaoGabinete;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  tamanhoMm!: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantidadeMaxima!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  espessuraMaximaMm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;
}
