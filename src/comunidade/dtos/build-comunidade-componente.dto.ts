import {
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';

export class BuildComunidadeComponenteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  hardwareId?: number;

  @IsEnum(CategoriaHardware)
  categoria!: CategoriaHardware;

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
  @MaxLength(500)
  imagemUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  posicao?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CATALOGO', 'EXTERNO', 'IA'])
  origem?: 'CATALOGO' | 'EXTERNO' | 'IA';

  @IsOptional()
  @IsObject()
  especificacoes?: Record<string, unknown>;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  fonteDadosUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  modelo3dUrl?: string;
}
