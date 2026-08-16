import {
  Max,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarEspecificacaoHeadsetDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tipoConexao?: string;

  @IsOptional()
  @IsBoolean()
  wireless?: boolean;

  @IsOptional()
  @IsBoolean()
  bluetooth?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  driverMm?: number;

  @IsOptional()
  @IsBoolean()
  microfone?: boolean;

  @IsOptional()
  @IsBoolean()
  somSurround?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  impedancia?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  pesoGramas?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  bateriaHoras?: number;
}
