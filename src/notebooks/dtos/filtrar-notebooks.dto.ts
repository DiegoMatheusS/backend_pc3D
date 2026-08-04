import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class FiltrarNotebooksDto {
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsString() processador?: string;
  @IsOptional() @IsString() gpu?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) ramMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) precoMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) precoMax?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) telaMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) hzMin?: number;
  @IsOptional() @IsString() busca?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
}
