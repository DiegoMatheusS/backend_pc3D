import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AtualizarAvaliacaoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  nota?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3000)
  comentario?: string;
}
