import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CriarEspecificacaoNotebookDto } from './criar-especificacao-notebook.dto';

export class AtualizarNotebookDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) nome?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) marca?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) modelo?: string;
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string;
  @IsOptional() @IsString() @MaxLength(150) mpn?: string;
  @IsOptional() @IsString() @MaxLength(32) gtin?: string;
  @IsOptional() @IsString() @MaxLength(500) imagemUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) imagemHoverUrl?: string;
  @IsOptional() @IsBoolean() publicado?: boolean;
  @IsOptional() @IsBoolean() ativo?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoNotebookDto)
  especificacao?: CriarEspecificacaoNotebookDto;
}
