import {
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';
import { IsSafeJsonObject } from '../../common/validators/is-safe-json-object.validator';

export class BuildComunidadeComponenteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
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
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  imagemUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64)
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
  @IsSafeJsonObject({ maxDepth: 6, maxKeys: 160, maxArrayLength: 64 })
  especificacoes?: Record<string, unknown>;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  fonteDadosUrl?: string;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  modelo3dUrl?: string;
}
