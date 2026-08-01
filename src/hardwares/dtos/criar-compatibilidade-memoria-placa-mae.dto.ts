import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarCompatibilidadeMemoriaPlacaMaeDto {
  @IsInt()
  @Min(1)
  placaMaeId!: number;

  @IsInt()
  @Min(1)
  memoriaRamId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  revisaoPlacaMae?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  biosTestada?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  familiaProcessadorTestada?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  frequenciaValidadaMhz?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeModulosTestados?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidadeTotalTestadaGb?: number;

  @IsOptional()
  @IsBoolean()
  compativel?: boolean;

  @IsOptional()
  @IsBoolean()
  constaNaQvl?: boolean;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fonteUrl?: string;

  @IsOptional()
  @IsDateString()
  verificadoEm?: string;
}
