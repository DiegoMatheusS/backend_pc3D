import { Transform, Type } from 'class-transformer';
import { OmitType } from '@nestjs/swagger';
import {
  IsInt,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsSafeJsonObject } from '../../common/validators/is-safe-json-object.validator';
import { CriarHardwareDto } from '../../hardwares/dtos/criar-hardware.dto';
import { CriarBuildDto } from '../../builds/dtos/criar-build.dto';
import { normalizarUrlAmazon } from '../../ofertas/utils/normalizar-url-amazon';
import { LIMITE_URL_OFERTA } from '../../ofertas/utils/limite-url-oferta';
import { CriarEspecificacaoHeadsetDto } from '../../produtos/dtos/especificacoes/criar-especificacao-headset.dto';
import { CriarEspecificacaoMonitorDto } from '../../produtos/dtos/especificacoes/criar-especificacao-monitor.dto';
import { CriarEspecificacaoMouseDto } from '../../produtos/dtos/especificacoes/criar-especificacao-mouse.dto';
import { CriarEspecificacaoTecladoDto } from '../../produtos/dtos/especificacoes/criar-especificacao-teclado.dto';

export class ParceiroOfertaExtensaoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  dominio?: string | null;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  site?: string | null;
}

export class OfertaExtensaoDto {
  @Transform(({ value }) => normalizarUrlAmazon(value))
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(LIMITE_URL_OFERTA)
  urlOriginal!: string;

  @Transform(({ value }) => normalizarUrlAmazon(value))
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(LIMITE_URL_OFERTA)
  urlAfiliada!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100_000_000)
  preco!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100_000_000)
  precoAnterior?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  codigoMarketplace?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  asin?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendedorNome?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendedorIdentificador?: string | null;
}

export class ProdutoOfertaExtensaoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  categoriaSlug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @IsOptional() @IsString() @MaxLength(100) marca?: string;
  @IsOptional() @IsString() @MaxLength(150) modelo?: string;
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string;
  @IsOptional() @IsString() @MaxLength(150) mpn?: string;
  @IsOptional() @IsString() @MaxLength(32) gtin?: string;
  @IsOptional() @IsString() @MaxLength(20) asin?: string;

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
  @IsSafeJsonObject({ maxDepth: 6, maxKeys: 160, maxArrayLength: 64 })
  metadados?: Record<string, unknown>;

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

export class BuildOfertaExtensaoDto extends OmitType(CriarBuildDto, [
  'oferta',
  'componentes',
  'configuracao3D',
  'publicado',
  'ativo',
] as const) {
  @IsOptional()
  @IsIn(['PC_MONTADO'])
  categoria?: string;
}

export class ImportarOfertaExtensaoProdutoIaDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CriarHardwareDto)
  hardwarePayload?: CriarHardwareDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProdutoOfertaExtensaoDto)
  produtoPayload?: ProdutoOfertaExtensaoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BuildOfertaExtensaoDto)
  buildPayload?: BuildOfertaExtensaoDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  hardwareExistenteId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  produtoExistenteId?: number;

  @ValidateNested()
  @Type(() => ParceiroOfertaExtensaoDto)
  parceiro!: ParceiroOfertaExtensaoDto;

  @ValidateNested()
  @Type(() => OfertaExtensaoDto)
  oferta!: OfertaExtensaoDto;
}
