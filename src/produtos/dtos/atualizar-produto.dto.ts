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
  ValidateNested,
} from 'class-validator';
import { CriarEspecificacaoHeadsetDto } from './especificacoes/criar-especificacao-headset.dto';
import { CriarEspecificacaoMonitorDto } from './especificacoes/criar-especificacao-monitor.dto';
import { CriarEspecificacaoMouseDto } from './especificacoes/criar-especificacao-mouse.dto';
import { CriarEspecificacaoTecladoDto } from './especificacoes/criar-especificacao-teclado.dto';

export class AtualizarProdutoDto {
  @IsOptional() @IsInt() @Min(1) categoriaId?: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) nome?: string;
  @IsOptional() @IsString() @MaxLength(100) marca?: string;
  @IsOptional() @IsString() @MaxLength(150) modelo?: string;
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string;
  @IsOptional() @IsString() @MaxLength(150) mpn?: string;
  @IsOptional() @IsString() @MaxLength(32) gtin?: string;
  @IsOptional() @IsString() @MaxLength(500) imagemUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) imagemHoverUrl?: string;
  @IsOptional() @IsObject() metadados?: Record<string, unknown>;
  @IsOptional() @IsBoolean() publicado?: boolean;
  @IsOptional() @IsBoolean() ativo?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoMonitorDto)
  especificacaoMonitor?: CriarEspecificacaoMonitorDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoMouseDto)
  especificacaoMouse?: CriarEspecificacaoMouseDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoTecladoDto)
  especificacaoTeclado?: CriarEspecificacaoTecladoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarEspecificacaoHeadsetDto)
  especificacaoHeadset?: CriarEspecificacaoHeadsetDto;
}
