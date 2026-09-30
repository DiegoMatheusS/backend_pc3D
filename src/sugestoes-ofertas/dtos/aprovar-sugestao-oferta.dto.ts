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
import { LIMITE_URL_OFERTA } from '../../ofertas/utils/limite-url-oferta';

export class AprovarSugestaoOfertaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  produtoId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  hardwareId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  parceiroId?: number;

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

  @IsOptional()
  @IsDateString()
  validoAte?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string | null;
}
