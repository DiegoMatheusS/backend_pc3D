import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsSafeJsonObject } from '../../common/validators/is-safe-json-object.validator';
import { CATEGORIAS_IMPORTACAO_IA } from '../../ia/dtos/categoria-importacao-ia';

export class AjustesCadastroChatbotDto {
  @IsOptional()
  @IsIn([...CATEGORIAS_IMPORTACAO_IA])
  categoria?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  hardwareId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  produtoId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  parceiroId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  categoriaId?: number;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  urlAfiliada?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  preco?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precoAnterior?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  codigoMarketplace?: string;

  @IsOptional()
  @IsObject()
  @IsSafeJsonObject({ maxDepth: 8, maxKeys: 300, maxArrayLength: 100 })
  dadosCorrigidos?: Record<string, unknown>;
}

export class ConfirmarCadastroChatbotDto {
  @IsUUID()
  tokenConfirmacao!: string;

  @IsBoolean()
  confirmar!: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AjustesCadastroChatbotDto)
  ajustes?: AjustesCadastroChatbotDto;
}
