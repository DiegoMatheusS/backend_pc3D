import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';
import { IsSafeJsonObject } from '../../common/validators/is-safe-json-object.validator';

function normalizarUrlHttpOpcional(valor: unknown): unknown {
  if (valor === null || valor === undefined) return undefined;
  if (typeof valor !== 'string') return valor;

  const normalizada = valor.trim();
  if (!normalizada) return undefined;

  // Builds salvas no navegador podem carregar caminhos locais/relativos,
  // data: ou blob:. Esses endereços servem apenas para a prévia do frontend
  // e não são URLs públicas persistíveis. Ao omiti-los, o service pode usar
  // a imagem/modelo oficiais do Hardware vinculado quando houver.
  if (!/^https?:\/\//i.test(normalizada)) return undefined;

  return normalizada;
}

export class BuildComunidadeComponenteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  hardwareId?: number;

  @IsEnum(CategoriaHardware)
  categoria!: CategoriaHardware;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  modelo?: string;

  @Transform(({ value }) => normalizarUrlHttpOpcional(value))
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  imagemUrl?: string;

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
  @IsString()
  @IsIn(['CATALOGO', 'EXTERNO', 'IA'])
  origem?: 'CATALOGO' | 'EXTERNO' | 'IA';

  @IsOptional()
  @IsObject()
  @IsSafeJsonObject({ maxDepth: 6, maxKeys: 160, maxArrayLength: 64 })
  especificacoes?: Record<string, unknown>;

  @Transform(({ value }) => normalizarUrlHttpOpcional(value))
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  fonteDadosUrl?: string;

  @Transform(({ value }) => normalizarUrlHttpOpcional(value))
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  modelo3dUrl?: string;
}
