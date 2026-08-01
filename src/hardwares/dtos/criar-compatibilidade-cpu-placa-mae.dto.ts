import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarCompatibilidadeCpuPlacaMaeDto {
  @IsInt()
  @Min(1)
  placaMaeId!: number;

  @IsInt()
  @Min(1)
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
  observacao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fonteUrl?: string;

  @IsOptional()
  @IsDateString()
  verificadoEm?: string;
}
