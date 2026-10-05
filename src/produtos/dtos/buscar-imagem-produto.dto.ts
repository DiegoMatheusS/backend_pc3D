import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class BuscarImagemProdutoDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  nome: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  marca?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(240)
  modelo?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(180)
  mpn?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  gtin?: string | null;
}
