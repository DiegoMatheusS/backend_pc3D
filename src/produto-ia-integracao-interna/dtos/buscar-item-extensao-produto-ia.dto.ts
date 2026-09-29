import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BuscarItemExtensaoProdutoIaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  modelo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  mpn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gtin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  asin?: string;
}
