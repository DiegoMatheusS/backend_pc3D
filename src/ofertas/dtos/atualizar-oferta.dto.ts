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
  @IsOptional() @IsString() @MaxLength(200) vendedorNome?: string | null;
  @IsOptional() @IsString() @MaxLength(200) vendedorIdentificador?:
    string | null;
  @IsOptional() @IsUrl() @MaxLength(500) urlOriginal?: string;
  @IsOptional() @IsUrl() @MaxLength(500) urlAfiliada?: string | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() preco?: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precoAnterior?: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) frete?:
    number | null;
  @IsOptional() @IsDateString() validoAte?: string | null;
  @IsOptional() @IsEnum(StatusOferta) status?: StatusOferta;
}
