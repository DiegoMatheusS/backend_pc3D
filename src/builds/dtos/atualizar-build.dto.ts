import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  ValidateIf,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsSafeJsonObject } from '../../common/validators/is-safe-json-object.validator';
import { BuildComponenteDto } from './criar-build.dto';

export class AtualizarBuildDto {
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;
  @IsOptional() @IsString() @MaxLength(100) marca?: string | null;
  @IsOptional() @IsString() @MaxLength(150) modelo?: string | null;
  @IsOptional() @IsString() @MaxLength(30000) descricao?: string | null;
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  imagemUrl?: string | null;
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  imagemHoverUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(100) categoria?: string | null;
  @IsOptional() @IsString() @MaxLength(150) finalidade?: string | null;
  @IsOptional() @IsString() @MaxLength(80) resolucaoRecomendada?: string | null;
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsObject()
  @IsSafeJsonObject({ maxDepth: 6, maxKeys: 200, maxArrayLength: 64 })
  configuracao3D?: Record<string, unknown>;
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsBoolean()
  publicado?: boolean;
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsBoolean()
  ativo?: boolean;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => BuildComponenteDto)
  componentes?: BuildComponenteDto[];
}
