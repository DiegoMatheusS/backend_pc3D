import { LIMITE_URL_OFERTA } from '../../ofertas/utils/limite-url-oferta';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsPositive,
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
import { CategoriaHardware } from '../../generated/prisma/enums';
import { IsSafeJsonObject } from '../../common/validators/is-safe-json-object.validator';

export class BuildComponenteDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  hardwareId!: number;

  @IsEnum(CategoriaHardware)
  categoria!: CategoriaHardware;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64)
  quantidade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  posicao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  ordem?: number;
}

export class BuildOfertaDto {
  @IsInt() @Min(1) parceiroId!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(99_999_999.99) preco!: number;
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, disallow_auth: true, ignore_max_length: true })
  @MaxLength(LIMITE_URL_OFERTA) urlOriginal!: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, disallow_auth: true })
  @MaxLength(LIMITE_URL_OFERTA) urlAfiliada?: string;
}

export class CriarBuildDto {
  @IsOptional() @ValidateNested() @Type(() => BuildOfertaDto)
  oferta?: BuildOfertaDto;
  @IsString() @MinLength(2) @MaxLength(200) nome!: string;
  @IsOptional() @IsString() @MaxLength(100) marca?: string;
  @IsOptional() @IsString() @MaxLength(150) modelo?: string;
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, disallow_auth: true })
  @MaxLength(500)
  imagemUrl?: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, disallow_auth: true })
  @MaxLength(500)
  imagemHoverUrl?: string;
  // KIT_UPGRADE usa a mesma estrutura comercial, mas categoria própria na loja.
  @IsOptional() @IsString() @MaxLength(100) categoria?: string;
  @IsOptional() @IsString() @MaxLength(150) finalidade?: string;
  @IsOptional() @IsString() @MaxLength(80) resolucaoRecomendada?: string;
  @IsOptional()
  @IsObject()
  @IsSafeJsonObject({ maxDepth: 6, maxKeys: 200, maxArrayLength: 64 })
  configuracao3D?: Record<string, unknown>;
  @IsOptional() @IsBoolean() publicado?: boolean;
  @IsOptional() @IsBoolean() ativo?: boolean;

  // PC comercial não é PC Builder: o anúncio pode informar apenas "16 GB RAM"
  // ou trazer periféricos sem modelos. Vínculos são sempre opcionais.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => BuildComponenteDto)
  componentes?: BuildComponenteDto[];
}
