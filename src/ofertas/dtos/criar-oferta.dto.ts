import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarOfertaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  produtoId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  hardwareId?: number;

  @IsInt()
  @Min(1)
  parceiroId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendedorNome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendedorIdentificador?: string;

  @IsUrl()
  @MaxLength(500)
  urlOriginal!: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  urlAfiliada?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  preco!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precoAnterior?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  frete?: number;

  @IsOptional()
  @IsDateString()
  validoAte?: string;
}
