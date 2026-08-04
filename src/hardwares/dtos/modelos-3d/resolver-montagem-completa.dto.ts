import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
  IsString,
  MaxLength,
} from 'class-validator';
import { PosicaoRefrigeracaoGabinete } from '../../../generated/prisma/enums';
import { ItemMontagem3DDto } from './resolver-montagem-3d.dto';
import { SentidoFluxoAr } from '../verificar-compatibilidade-montagem.dto';

/**
 * Ventoinha com posição e sentido opcionais para análise de fluxo de ar.
 * Ao contrário de VentoinhaMontagemDto, aqui a quantidade é omitida porque
 * ela é inferida pela contagem das instâncias na montagem 3D.
 */

/**
 * Configuração física de uma ventoinha na montagem.
 *
 * instanciaId identifica uma peça física específica da árvore 3D.
 * ventoinhaId é mantido temporariamente para compatibilidade com
 * o formato anterior da API.
 */

export class VentoinhaCompletaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  instanciaId?: string;

  @IsInt()
  @Min(1)
  ventoinhaId!: number;

  @IsEnum(PosicaoRefrigeracaoGabinete)
  posicao!: PosicaoRefrigeracaoGabinete;

  @IsOptional()
  @IsEnum(SentidoFluxoAr)
  sentido?: SentidoFluxoAr;
}

/**
 * Body da rota POST :gabineteId/montagem-completa/resolver.
 *
 * Unifica os dois sistemas:
 *   - itens: estrutura de instâncias físicas da montagem 3D
 *   - fonteId: obrigatório para calcular consumo e headroom
 *   - ventoinhas: opcional, informa posição/sentido de cada modelo de ventoinha
 *   - coolerId: opcional, para verificar compatibilidade do cooler
 *
 * Os hardwareIds de processador, RAM, GPU, armazenamento e ventoinha
 * são extraídos automaticamente das instâncias resolvidas — não precisam
 * ser informados duas vezes.
 */
export class ResolverMontagemCompletaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemMontagem3DDto)
  itens!: ItemMontagem3DDto[];

  @IsInt()
  @Min(1)
  fonteId!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VentoinhaCompletaDto)
  ventoinhas?: VentoinhaCompletaDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  coolerId?: number;
}
