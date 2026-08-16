import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RecomendarLojaIaDto {
  @IsString()
  @MaxLength(1000)
  mensagem!: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  categoria?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(100_000_000)
  orcamento?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limite?: number;
}
