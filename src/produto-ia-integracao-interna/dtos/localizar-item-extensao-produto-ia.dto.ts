import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LocalizarItemExtensaoProdutoIaDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  asin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gtin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  mpn?: string;

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
  @MaxLength(200)
  nome?: string;
}
