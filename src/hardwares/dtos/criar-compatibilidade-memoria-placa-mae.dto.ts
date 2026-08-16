import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarCompatibilidadeMemoriaPlacaMaeDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  placaMaeId!: number;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
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
  @Max(100_000)
  frequenciaValidadaMhz?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64)
  quantidadeModulosTestados?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16_384)
  capacidadeTotalTestadaGb?: number;

  @IsOptional()
  @IsBoolean()
  compativel?: boolean;

  @IsOptional()
  @IsBoolean()
  constaNaQvl?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  fonteUrl?: string;

  @IsOptional()
  @IsDateString()
  verificadoEm?: string;
}
