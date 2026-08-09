import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';
import { UsoPC } from './chat-ia.dto';
import { IsSafeJsonObject } from '../../common/validators/is-safe-json-object.validator';

export enum AcaoMontagemGuiadaIa {
  INICIAR = 'INICIAR',
  SELECIONAR = 'SELECIONAR',
  PULAR = 'PULAR',
  VOLTAR = 'VOLTAR',
  VER_MAIS = 'VER_MAIS',
  FILTRAR = 'FILTRAR',
  IA_DECIDIR = 'IA_DECIDIR',
}

export enum EtapaMontagemGuiadaIa {
  PROCESSADOR = 'PROCESSADOR',
  PLACA_MAE = 'PLACA_MAE',
  MEMORIA_RAM = 'MEMORIA_RAM',
  PLACA_VIDEO = 'PLACA_VIDEO',
  ARMAZENAMENTO = 'ARMAZENAMENTO',
  FONTE = 'FONTE',
  GABINETE = 'GABINETE',
  COOLER = 'COOLER',
  VENTOINHA = 'VENTOINHA',
  RESUMO = 'RESUMO',
}

export enum OrigemComponenteIa {
  CATALOGO = 'CATALOGO',
  EXTERNO = 'EXTERNO',
  IA = 'IA',
}

export class ComponenteSnapshotIaDto {
  @IsEnum(CategoriaHardware)
  categoria!: CategoriaHardware;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  hardwareId?: number;

  @IsString()
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
  modelo3dUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32)
  quantidade?: number;

  @IsEnum(OrigemComponenteIa)
  origem!: OrigemComponenteIa;

  @IsOptional()
  @IsObject()
  @IsSafeJsonObject({ maxDepth: 6, maxKeys: 160, maxArrayLength: 64 })
  especificacoes?: Record<string, unknown>;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  fonteDadosUrl?: string;
}

export class MontagemGuiadaIaDto {
  @IsEnum(AcaoMontagemGuiadaIa)
  acao!: AcaoMontagemGuiadaIa;

  @IsOptional()
  @IsEnum(EtapaMontagemGuiadaIa)
  etapaAtual?: EtapaMontagemGuiadaIa;

  @IsOptional()
  @ValidateNested()
  @Type(() => ComponenteSnapshotIaDto)
  selecao?: ComponenteSnapshotIaDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => ComponenteSnapshotIaDto)
  componentes?: ComponenteSnapshotIaDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(100_000_000)
  orcamento?: number;

  @IsOptional()
  @IsEnum(UsoPC)
  uso?: UsoPC;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  filtro?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  pagina?: number;
}
