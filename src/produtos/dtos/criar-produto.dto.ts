import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsSafeJsonObject } from '../../common/validators/is-safe-json-object.validator';
import { CriarEspecificacaoHeadsetDto } from './especificacoes/criar-especificacao-headset.dto';
import { CriarEspecificacaoMonitorDto } from './especificacoes/criar-especificacao-monitor.dto';
import { CriarEspecificacaoMouseDto } from './especificacoes/criar-especificacao-mouse.dto';
import { CriarEspecificacaoTecladoDto } from './especificacoes/criar-especificacao-teclado.dto';
import { CriarOfertaInicialProdutoDto } from './criar-oferta-inicial-produto.dto';

export class CriarProdutoDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  categoriaId!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  modelo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30000)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  mpn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gtin?: string;

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

  @IsOptional()
  @IsObject()
  @IsSafeJsonObject({ maxDepth: 6, maxKeys: 1500, maxArrayLength: 300 })
  metadados?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CriarOfertaInicialProdutoDto)
  ofertaInicial?: CriarOfertaInicialProdutoDto;

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
