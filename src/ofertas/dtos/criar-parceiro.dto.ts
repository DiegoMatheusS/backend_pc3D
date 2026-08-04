import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CriarParceiroDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nome!: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  site?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  dominio?: string;

  @IsOptional()
  @IsBoolean()
  programaAfiliados?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;
}
