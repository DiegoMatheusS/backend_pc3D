import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoMemoria } from '../../generated/prisma/enums';

export class CriarEspecificacaoNotebookDto {
  @IsOptional() @IsString() @MaxLength(200) processadorNome?: string;
  @IsOptional() @IsString() @MaxLength(100) processadorMarca?: string;
  @IsOptional() @IsString() @MaxLength(100) processadorGeracao?: string;
  @IsOptional() @IsInt() @Min(1) nucleos?: number;
  @IsOptional() @IsInt() @Min(1) threads?: number;
  @IsOptional() @IsInt() @Min(1) clockBaseMhz?: number;
  @IsOptional() @IsInt() @Min(1) clockTurboMhz?: number;
  @IsOptional() @IsInt() @Min(1) tdpWatts?: number;
  @IsOptional() @IsString() @MaxLength(200) gpuNome?: string;
  @IsOptional() @IsBoolean() gpuIntegrada?: boolean;
  @IsOptional() @IsBoolean() gpuDedicada?: boolean;
  @IsOptional() @IsInt() @Min(0) vramGb?: number;
  @IsOptional() @IsInt() @Min(0) tgpWatts?: number;
  @IsOptional() @IsInt() @Min(1) ramInstaladaGb?: number;
  @IsOptional() @IsEnum(TipoMemoria) tipoMemoria?: TipoMemoria;
  @IsOptional() @IsInt() @Min(1) frequenciaMhz?: number;
  @IsOptional() @IsInt() @Min(0) ramSoldadaGb?: number;
  @IsOptional() @IsInt() @Min(0) slotsRamTotal?: number;
  @IsOptional() @IsInt() @Min(0) slotsRamLivres?: number;
  @IsOptional() @IsInt() @Min(1) ramMaximaGb?: number;
  @IsOptional() @IsBoolean() upgradeRam?: boolean;
  @IsOptional() @IsInt() @Min(1) armazenamentoGb?: number;
  @IsOptional() @IsString() @MaxLength(80) tipoArmazenamento?: string;
  @IsOptional() @IsInt() @Min(0) slotsM2Total?: number;
  @IsOptional() @IsInt() @Min(0) slotsM2Livres?: number;
  @IsOptional() @IsBoolean() upgradeArmazenamento?: boolean;
  @IsOptional() @IsNumber() @Min(1) tamanhoTelaPolegadas?: number;
  @IsOptional() @IsInt() @Min(1) resolucaoLargura?: number;
  @IsOptional() @IsInt() @Min(1) resolucaoAltura?: number;
  @IsOptional() @IsInt() @Min(1) taxaAtualizacaoHz?: number;
  @IsOptional() @IsString() @MaxLength(80) tipoPainel?: string;
  @IsOptional() @IsInt() @Min(0) brilhoNits?: number;
  @IsOptional() @IsBoolean() touch?: boolean;
  @IsOptional() @IsNumber() @Min(0) bateriaWh?: number;
  @IsOptional() @IsNumber() @Min(0) autonomiaInformadaHoras?: number;
  @IsOptional() @IsInt() @Min(1) potenciaCarregadorWatts?: number;
  @IsOptional() @IsNumber() @Min(0) pesoKg?: number;
  @IsOptional() @IsNumber() @Min(0) larguraMm?: number;
  @IsOptional() @IsNumber() @Min(0) alturaMm?: number;
  @IsOptional() @IsNumber() @Min(0) profundidadeMm?: number;
  @IsOptional() @IsString() @MaxLength(100) wifi?: string;
  @IsOptional() @IsString() @MaxLength(100) bluetooth?: string;
  @IsOptional() @IsInt() @Min(0) usbA?: number;
  @IsOptional() @IsInt() @Min(0) usbC?: number;
  @IsOptional() @IsInt() @Min(0) thunderbolt?: number;
  @IsOptional() @IsInt() @Min(0) hdmi?: number;
  @IsOptional() @IsInt() @Min(0) displayPort?: number;
  @IsOptional() @IsBoolean() ethernet?: boolean;
  @IsOptional() @IsBoolean() leitorCartao?: boolean;
  @IsOptional() @IsString() @MaxLength(150) sistemaOperacional?: string;
  @IsOptional() @IsBoolean() webcam?: boolean;
  @IsOptional() @IsString() @MaxLength(80) resolucaoWebcam?: string;
  @IsOptional() @IsBoolean() tecladoIluminado?: boolean;
  @IsOptional() @IsBoolean() tecladoNumerico?: boolean;
  @IsOptional() @IsBoolean() leitorDigital?: boolean;
}
