import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum TagBuscaOferta {
  PLACA_VIDEO = 'PLACA_VIDEO',
  PROCESSADOR = 'PROCESSADOR',
  PLACA_MAE = 'PLACA_MAE',
  MEMORIA_RAM = 'MEMORIA_RAM',
  SSD = 'SSD',
  FONTE = 'FONTE',
  GABINETE = 'GABINETE',
  MONITOR = 'MONITOR',
  NOTEBOOK = 'NOTEBOOK',
  CELULAR = 'CELULAR',
  PERIFERICOS = 'PERIFERICOS',
  OUTROS = 'OUTROS',
}

export enum OrdenacaoBuscaOferta {
  MAIOR_DESCONTO = 'MAIOR_DESCONTO',
  MENOR_PRECO = 'MENOR_PRECO',
  MAIOR_PRECO = 'MAIOR_PRECO',
  MAIS_RECENTES = 'MAIS_RECENTES',
}

export class FiltrarBuscaOfertasDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busca?: string;

  @IsOptional()
  @IsEnum(TagBuscaOferta)
  tag?: TagBuscaOferta;

  @IsOptional()
  @IsEnum(TagBuscaOferta)
  categoria?: TagBuscaOferta;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  descontoMinimo?: number;

  @IsOptional()
  @IsEnum(OrdenacaoBuscaOferta)
  ordenar?: OrdenacaoBuscaOferta;
}
