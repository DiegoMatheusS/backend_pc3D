import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { StatusOferta } from '../../generated/prisma/enums';

export class AtualizarOfertaDto {
  @IsOptional() @IsString() @MaxLength(200) vendedorNome?: string;
  @IsOptional() @IsString() @MaxLength(200) vendedorIdentificador?: string;
  @IsOptional() @IsUrl() @MaxLength(500) urlOriginal?: string;
  @IsOptional() @IsUrl() @MaxLength(500) urlAfiliada?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() preco?: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precoAnterior?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) frete?: number;
  @IsOptional() @IsDateString() validoAte?: string;
  @IsOptional() @IsEnum(StatusOferta) status?: StatusOferta;
}
