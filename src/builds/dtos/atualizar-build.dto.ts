import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BuildComponenteDto } from './criar-build.dto';

export class AtualizarBuildDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) nome?: string;
  @IsOptional() @IsString() @MaxLength(100) marca?: string;
  @IsOptional() @IsString() @MaxLength(150) modelo?: string;
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string;
  @IsOptional() @IsString() @MaxLength(500) imagemUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) imagemHoverUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) categoria?: string;
  @IsOptional() @IsString() @MaxLength(150) finalidade?: string;
  @IsOptional() @IsString() @MaxLength(80) resolucaoRecomendada?: string;
  @IsOptional() @IsObject() configuracao3D?: Record<string, unknown>;
  @IsOptional() @IsBoolean() publicado?: boolean;
  @IsOptional() @IsBoolean() ativo?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuildComponenteDto)
  componentes?: BuildComponenteDto[];
}
