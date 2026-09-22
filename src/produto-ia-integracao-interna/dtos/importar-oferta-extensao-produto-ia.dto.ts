import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CriarHardwareDto } from '../../hardwares/dtos/criar-hardware.dto';

export class ParceiroOfertaExtensaoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  dominio?: string | null;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  site?: string | null;
}

export class OfertaExtensaoDto {
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  urlOriginal!: string;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
  @MaxLength(500)
  urlAfiliada!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100_000_000)
  preco!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100_000_000)
  precoAnterior?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  codigoMarketplace?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendedorNome?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendedorIdentificador?: string | null;
}

export class ImportarOfertaExtensaoProdutoIaDto {
  @ValidateNested()
  @Type(() => CriarHardwareDto)
  hardwarePayload!: CriarHardwareDto;

  @ValidateNested()
  @Type(() => ParceiroOfertaExtensaoDto)
  parceiro!: ParceiroOfertaExtensaoDto;

  @ValidateNested()
  @Type(() => OfertaExtensaoDto)
  oferta!: OfertaExtensaoDto;
}
