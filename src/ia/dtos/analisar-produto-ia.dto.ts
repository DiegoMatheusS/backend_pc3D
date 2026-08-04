import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class AnalisarProdutoIaDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  hardwareId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  produtoId?: number;
}

export class NormalizarProdutoIaDto {
  @IsString()
  @MaxLength(50000)
  conteudoBruto!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  urlOrigem?: string;
}

export class GerarDescricaoIaDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  hardwareId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  produtoId?: number;
}
