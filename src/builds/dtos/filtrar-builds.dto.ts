import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class FiltrarBuildsDto {
  @IsOptional() @IsString() uso?: string;
  @IsOptional() @IsString() resolucao?: string;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsString() busca?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) precoMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) precoMax?: number;
  @IsOptional() @IsString() parceiro?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
}
