import {
  Max,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarEspecificacaoMonitorDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  tamanhoPolegadas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  resolucao?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  taxaAtualizacaoHz?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tipoPainel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  tempoRespostaMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  brilhoNits?: number;

  @IsOptional()
  @IsBoolean()
  hdr?: boolean;

  @IsOptional()
  @IsBoolean()
  adaptiveSync?: boolean;

  @IsOptional()
  @IsBoolean()
  gSync?: boolean;

  @IsOptional()
  @IsBoolean()
  freeSync?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  hdmi?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  displayPort?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  usbC?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vesa?: string;
}
