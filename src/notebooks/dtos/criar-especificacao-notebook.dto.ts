import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoMemoria } from '../../generated/prisma/enums';

export class CriarEspecificacaoNotebookDto {
  @IsOptional() @IsString() @MaxLength(200) processadorNome?: string;
  @IsOptional() @IsString() @MaxLength(100) processadorMarca?: string;
  @IsOptional() @IsString() @MaxLength(100) processadorGeracao?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  nucleos?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  threads?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  clockBaseMhz?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  clockTurboMhz?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  tdpWatts?: number;
  @IsOptional() @IsString() @MaxLength(200) gpuNome?: string;
  @IsOptional() @IsBoolean() gpuIntegrada?: boolean;
  @IsOptional() @IsBoolean() gpuDedicada?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  vramGb?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  tgpWatts?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  ramInstaladaGb?: number;
  @IsOptional() @IsEnum(TipoMemoria) tipoMemoria?: TipoMemoria;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  frequenciaMhz?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  ramSoldadaGb?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  slotsRamTotal?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  slotsRamLivres?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  ramMaximaGb?: number;
  @IsOptional() @IsBoolean() upgradeRam?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  armazenamentoGb?: number;
  @IsOptional() @IsString() @MaxLength(80) tipoArmazenamento?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  slotsM2Total?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  slotsM2Livres?: number;
  @IsOptional() @IsBoolean() upgradeArmazenamento?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  tamanhoTelaPolegadas?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  resolucaoLargura?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  resolucaoAltura?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  taxaAtualizacaoHz?: number;
  @IsOptional() @IsString() @MaxLength(80) tipoPainel?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  brilhoNits?: number;
  @IsOptional() @IsBoolean() touch?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  bateriaWh?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  autonomiaInformadaHoras?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  potenciaCarregadorWatts?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  pesoKg?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  larguraMm?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  alturaMm?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  profundidadeMm?: number;
  @IsOptional() @IsString() @MaxLength(100) wifi?: string;
  @IsOptional() @IsString() @MaxLength(100) bluetooth?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  usbA?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  usbC?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  thunderbolt?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  hdmi?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  displayPort?: number;
  @IsOptional() @IsBoolean() ethernet?: boolean;
  @IsOptional() @IsBoolean() leitorCartao?: boolean;
  @IsOptional() @IsString() @MaxLength(150) sistemaOperacional?: string;
  @IsOptional() @IsBoolean() webcam?: boolean;
  @IsOptional() @IsString() @MaxLength(80) resolucaoWebcam?: string;
  @IsOptional() @IsBoolean() tecladoIluminado?: boolean;
  @IsOptional() @IsBoolean() tecladoNumerico?: boolean;
  @IsOptional() @IsBoolean() leitorDigital?: boolean;
}
