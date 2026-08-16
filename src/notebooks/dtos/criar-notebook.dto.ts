import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CriarEspecificacaoNotebookDto } from './criar-especificacao-notebook.dto';

export class CriarNotebookDto {
  @IsString() @MinLength(2) @MaxLength(200) nome!: string;
  @IsString() @MinLength(1) @MaxLength(100) marca!: string;
  @IsString() @MinLength(1) @MaxLength(150) modelo!: string;
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string;
  @IsOptional() @IsString() @MaxLength(150) mpn?: string;
  @IsOptional() @IsString() @MaxLength(32) gtin?: string;
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  imagemUrl?: string;
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  imagemHoverUrl?: string;
  @IsOptional() @IsBoolean() publicado?: boolean;
  @IsOptional() @IsBoolean() ativo?: boolean;

  @ValidateNested()
  @Type(() => CriarEspecificacaoNotebookDto)
  especificacao!: CriarEspecificacaoNotebookDto;
}
