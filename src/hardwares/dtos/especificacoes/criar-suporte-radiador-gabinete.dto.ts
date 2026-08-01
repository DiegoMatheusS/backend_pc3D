import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
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
  tamanhoMm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  espessuraConjuntoMaximaMm?: number;

  @IsOptional()
  @IsString()
  observacao?: string;
}
