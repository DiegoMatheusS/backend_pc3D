import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CriarEspecificacaoNotebookDto } from './criar-especificacao-notebook.dto';

export class AtualizarNotebookDto {
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  marca?: string;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  modelo?: string;

  @IsOptional() @IsString() @MaxLength(30000) descricao?: string | null;
  @IsOptional() @IsString() @MaxLength(150) mpn?: string | null;
  @IsOptional() @IsString() @MaxLength(32) gtin?: string | null;
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  imagemUrl?: string | null;
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  imagemHoverUrl?: string | null;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsBoolean()
  publicado?: boolean;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsBoolean()
  ativo?: boolean;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @ValidateNested()
  @Type(() => CriarEspecificacaoNotebookDto)
  especificacao?: CriarEspecificacaoNotebookDto;
}
