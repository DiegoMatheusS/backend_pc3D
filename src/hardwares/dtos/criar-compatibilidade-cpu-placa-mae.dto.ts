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

export class CriarCompatibilidadeCpuPlacaMaeDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  placaMaeId!: number;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  processadorId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  revisaoPlacaMae?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  biosMinima?: string;

  @IsOptional()
  @IsBoolean()
  compativel?: boolean;

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
