import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
export class DescobrirOfertasDto {
  @IsIn(['MERCADO_LIVRE', 'MAGALU']) loja!: 'MERCADO_LIVRE' | 'MAGALU';
  @IsString() @MinLength(2) @MaxLength(300) consulta!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
  @IsOptional() @IsBoolean() somentePromocoes?: boolean;
}
