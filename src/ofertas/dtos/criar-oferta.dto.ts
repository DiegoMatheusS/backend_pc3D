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

export class CriarOfertaDto {
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

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  urlOriginal!: string;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
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
