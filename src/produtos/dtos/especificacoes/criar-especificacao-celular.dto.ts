import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarEspecificacaoCelularDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  processadorNome?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1024)
  ramGb?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  armazenamentoGb?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  tamanhoTelaPolegadas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  resolucao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  taxaAtualizacaoHz?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tipoTela?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  cameraPrincipalMp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  cameraFrontalMp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  bateriaMah?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  carregamentoWatts?: number;

  @IsOptional()
  @IsBoolean()
  cincoG?: boolean;

  @IsOptional()
  @IsBoolean()
  nfc?: boolean;

  @IsOptional()
  @IsBoolean()
  dualSim?: boolean;

  @IsOptional()
  @IsBoolean()
  esim?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  wifi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bluetooth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  sistemaOperacional?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  pesoGramas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  resistenciaAgua?: string;
}
