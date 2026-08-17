import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CATEGORIAS_SUGESTAO_OFERTA } from '../campos-sugestao-oferta';

export class CriarSugestaoOfertaDto {
  @IsString()
  @MaxLength(200)
  nome!: string;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  urlOriginal!: string;

  @IsString()
  @IsIn([...CATEGORIAS_SUGESTAO_OFERTA])
  categoria!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100_000_000)
  preco!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100_000_000)
  precoAnterior?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  produtoId?: number | null;

  @IsOptional()
  @IsObject()
  especificacoes?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string | null;
}
