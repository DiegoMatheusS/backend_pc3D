import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class BuscarProdutosShopeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  consulta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  itemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  shopId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  @IsOptional()
  @IsBoolean()
  somentePromocoes?: boolean;
}

export class BuscarPromocoesShopeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  consulta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;
}

export class GerarLinkShopeeDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(4096)
  url!: string;

  @IsOptional()
  @IsString({ each: true })
  subIds?: string[];
}

export class SincronizarOfertasShopeeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite?: number;
}
