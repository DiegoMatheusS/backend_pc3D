import { Type } from 'class-transformer';
import {
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

  /**
   * Quantidade física de módulos deste modelo de memória RAM.
   * Na montagem completa, o backend agrupa as instâncias por hardwareId e
   * usa este valor para QVL e capacidade deste modelo. Em chamadas antigas
   * sem quantidadeModulosRamTotal, ele também continua servindo como total
   * físico para a checagem de slots.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeModulosRam?: number;

  /**
   * Quantidade total de módulos RAM físicos, somando modelos diferentes.
   * É usada para validar ocupação de slots. Quando omitida, o backend usa
   * quantidadeModulosRam, preservando compatibilidade com o contrato antigo.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeModulosRamTotal?: number;

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
  @IsInt({ each: true })
  @Min(1, { each: true })
  armazenamentoIds?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VentoinhaMontagemDto)
  ventoinhas?: VentoinhaMontagemDto[];
}
