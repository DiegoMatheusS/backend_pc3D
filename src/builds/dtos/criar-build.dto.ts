import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';

export class BuildComponenteDto {
  @IsInt()
  @Min(1)
  hardwareId!: number;

  @IsEnum(CategoriaHardware)
  categoria!: CategoriaHardware;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  posicao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}

export class CriarBuildDto {
  @IsString() @MinLength(2) @MaxLength(200) nome!: string;
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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BuildComponenteDto)
  componentes!: BuildComponenteDto[];
}
