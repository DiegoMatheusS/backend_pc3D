import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class ConsultarProdutoMercadoLivreDto {
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, disallow_auth: true })
  @MaxLength(4096)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  itemId?: string;

  @IsOptional()
  @IsBoolean()
  permitirFallback?: boolean;
}

export class SincronizarOfertasMercadoLivreDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite?: number;
}
