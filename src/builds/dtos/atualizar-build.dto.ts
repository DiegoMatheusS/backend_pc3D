import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  ValidateIf,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BuildComponenteDto } from './criar-build.dto';

export class AtualizarBuildDto {
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;
  @IsOptional() @IsString() @MaxLength(100) marca?: string | null;
  @IsOptional() @IsString() @MaxLength(150) modelo?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string | null;
  @IsOptional() @IsString() @MaxLength(500) imagemUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(500) imagemHoverUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(100) categoria?: string | null;
  @IsOptional() @IsString() @MaxLength(150) finalidade?: string | null;
  @IsOptional() @IsString() @MaxLength(80) resolucaoRecomendada?: string | null;
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsObject()
  configuracao3D?: Record<string, unknown>;
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsBoolean()
  publicado?: boolean;
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsBoolean()
  ativo?: boolean;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuildComponenteDto)
  componentes?: BuildComponenteDto[];
}
