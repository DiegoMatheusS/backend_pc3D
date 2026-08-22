import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
} from 'class-validator';
import { CATEGORIAS_IMPORTACAO_IA } from './categoria-importacao-ia';
import type { CategoriaImportacaoIa } from './categoria-importacao-ia';

export class AnalisarProdutoIaDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  hardwareId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  produtoId?: number;
}

export class NormalizarProdutoIaDto {
  @IsString()
  @MaxLength(50000)
  conteudoBruto!: string;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  urlOrigem?: string;

  @IsOptional()
  @IsIn(CATEGORIAS_IMPORTACAO_IA)
  categoriaEsperada?: CategoriaImportacaoIa;
}

export class GerarDescricaoIaDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  hardwareId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  produtoId?: number;
}
