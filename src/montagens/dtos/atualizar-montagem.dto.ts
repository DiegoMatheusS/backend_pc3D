import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StatusMontagem } from '../../generated/prisma/enums';
import { ItemMontagem3DDto } from '../../hardwares/dtos/modelos-3d/resolver-montagem-3d.dto';
import { VentoinhaCompletaDto } from '../../hardwares/dtos/modelos-3d/resolver-montagem-completa.dto';

export class AtualizarMontagemDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  gabineteId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  fonteId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  coolerId?: number;

  @IsOptional()
  @IsBoolean()
  publico?: boolean;

  @IsOptional()
  @IsEnum(StatusMontagem)
  status?: StatusMontagem;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemMontagem3DDto)
  itens?: ItemMontagem3DDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VentoinhaCompletaDto)
  ventoinhas?: VentoinhaCompletaDto[];
}
