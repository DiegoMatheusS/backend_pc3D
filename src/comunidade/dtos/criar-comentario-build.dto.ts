import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CriarComentarioBuildDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  texto!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  comentarioPaiId?: number;
}
