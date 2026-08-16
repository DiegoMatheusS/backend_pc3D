import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { StatusComentarioBuild } from '../../generated/prisma/enums';

export class AtualizarComentarioBuildDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  texto?: string;

  @IsOptional()
  @IsEnum(StatusComentarioBuild)
  status?: StatusComentarioBuild;
}
