import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { normalizarUrlAmazon } from '../../ofertas/utils/normalizar-url-amazon';
import { LIMITE_URL_OFERTA } from '../../ofertas/utils/limite-url-oferta';

/**
 * Oferta opcional criada na mesma transação do Produto.
 * O vínculo produtoId/hardwareId é definido internamente pelo backend.
 */
export class CriarOfertaInicialProdutoDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  parceiroId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendedorNome?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendedorIdentificador?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  codigoMarketplace?: string | null;

  @Transform(({ value }) => normalizarUrlAmazon(value))
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(LIMITE_URL_OFERTA)
  urlOriginal!: string;

  @Transform(({ value }) => normalizarUrlAmazon(value))
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(LIMITE_URL_OFERTA)
  urlAfiliada?: string | null;

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
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  frete?: number | null;

  @IsOptional()
  @IsDateString()
  validoAte?: string | null;
}
