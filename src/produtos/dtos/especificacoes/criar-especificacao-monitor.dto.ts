import {
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
  tamanhoPolegadas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  resolucao?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  taxaAtualizacaoHz?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tipoPainel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tempoRespostaMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
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
  hdmi?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayPort?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  usbC?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vesa?: string;
}
