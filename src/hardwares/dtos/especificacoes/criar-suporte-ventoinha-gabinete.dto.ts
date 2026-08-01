import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
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
  tamanhoMm!: number;

  @IsInt()
  @Min(1)
  quantidadeMaxima!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  espessuraMaximaMm?: number;

  @IsOptional()
  @IsString()
  observacao?: string;
}
