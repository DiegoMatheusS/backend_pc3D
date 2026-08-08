import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CriarEspecificacaoHeadsetDto } from './especificacoes/criar-especificacao-headset.dto';
import { CriarEspecificacaoMonitorDto } from './especificacoes/criar-especificacao-monitor.dto';
import { CriarEspecificacaoMouseDto } from './especificacoes/criar-especificacao-mouse.dto';
import { CriarEspecificacaoTecladoDto } from './especificacoes/criar-especificacao-teclado.dto';

export class AtualizarProdutoDto {
  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsInt()
  @Min(1)
  categoriaId?: number;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;

  @IsOptional() @IsString() @MaxLength(100) marca?: string | null;
  @IsOptional() @IsString() @MaxLength(150) modelo?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string | null;
  @IsOptional() @IsString() @MaxLength(150) mpn?: string | null;
  @IsOptional() @IsString() @MaxLength(32) gtin?: string | null;
  @IsOptional() @IsString() @MaxLength(500) imagemUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(500) imagemHoverUrl?: string | null;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsObject()
  metadados?: Record<string, unknown>;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsBoolean()
  publicado?: boolean;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @IsBoolean()
  ativo?: boolean;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @ValidateNested()
  @Type(() => CriarEspecificacaoMonitorDto)
  especificacaoMonitor?: CriarEspecificacaoMonitorDto;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @ValidateNested()
  @Type(() => CriarEspecificacaoMouseDto)
  especificacaoMouse?: CriarEspecificacaoMouseDto;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @ValidateNested()
  @Type(() => CriarEspecificacaoTecladoDto)
  especificacaoTeclado?: CriarEspecificacaoTecladoDto;

  @ValidateIf((_obj, valor) => valor !== undefined)
  @ValidateNested()
  @Type(() => CriarEspecificacaoHeadsetDto)
  especificacaoHeadset?: CriarEspecificacaoHeadsetDto;
}
