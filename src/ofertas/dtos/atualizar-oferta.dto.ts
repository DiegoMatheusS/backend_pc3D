import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { StatusOferta } from '../../generated/prisma/enums';
import { normalizarUrlAmazon } from '../utils/normalizar-url-amazon';
import { LIMITE_URL_OFERTA } from '../utils/limite-url-oferta';

export class AtualizarOfertaDto {
  @IsOptional() @IsString() @MaxLength(200) vendedorNome?: string | null;
  @IsOptional() @IsString() @MaxLength(200) vendedorIdentificador?:
    string | null;
  @IsOptional() @IsString() @MaxLength(160) codigoMarketplace?: string | null;
  @Transform(({ value }) => normalizarUrlAmazon(value))
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(LIMITE_URL_OFERTA)
  urlOriginal?: string;
  @Transform(({ value }) => normalizarUrlAmazon(value))
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(LIMITE_URL_OFERTA)
  urlAfiliada?: string | null;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100_000_000)
  preco?: number;
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
  @IsOptional() @IsDateString() validoAte?: string | null;
  @IsOptional() @IsEnum(StatusOferta) status?: StatusOferta;
}
