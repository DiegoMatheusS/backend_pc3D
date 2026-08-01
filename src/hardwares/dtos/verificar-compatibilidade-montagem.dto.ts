import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { PosicaoRefrigeracaoGabinete } from '../../generated/prisma/enums';

export enum SentidoFluxoAr {
  ENTRADA = 'ENTRADA',
  SAIDA = 'SAIDA',
}

export class VentoinhaMontagemDto {
  @IsInt()
  @Min(1)
  ventoinhaId!: number;

  @IsEnum(PosicaoRefrigeracaoGabinete)
  posicao!: PosicaoRefrigeracaoGabinete;

  @IsInt()
  @Min(1)
  quantidade!: number;

  @IsOptional()
  @IsEnum(SentidoFluxoAr)
  sentido?: SentidoFluxoAr;
}

export class VerificarCompatibilidadeMontagemDto {
  @IsInt()
  @Min(1)
  placaMaeId!: number;

  @IsInt()
  @Min(1)
  processadorId!: number;

  @IsInt()
  @Min(1)
  memoriaRamId!: number;

  @IsInt()
  @Min(1)
  gabineteId!: number;

  @IsInt()
  @Min(1)
  fonteId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  placaVideoId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  coolerId?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  armazenamentoIds?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VentoinhaMontagemDto)
  ventoinhas?: VentoinhaMontagemDto[];
}
