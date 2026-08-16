import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VisibilidadeBuildComunidade } from '../../generated/prisma/enums';
import { BuildComunidadeComponenteDto } from './build-comunidade-componente.dto';

export class CriarBuildComunidadeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  finalidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  resolucao?: string;

  @IsOptional()
  @IsEnum(VisibilidadeBuildComunidade)
  visibilidade?: VisibilidadeBuildComunidade;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => BuildComunidadeComponenteDto)
  componentes?: BuildComunidadeComponenteDto[];
}
