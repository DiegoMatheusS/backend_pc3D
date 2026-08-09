import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
} from 'class-validator';

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
