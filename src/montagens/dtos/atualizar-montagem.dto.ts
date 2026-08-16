import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
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
  @Max(2_147_483_647)
  gabineteId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  fonteId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  coolerId?: number | null;

  @IsOptional()
  @IsBoolean()
  publico?: boolean;

  @IsOptional()
  @IsEnum(StatusMontagem)
  status?: StatusMontagem;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(128)
  @ValidateNested({ each: true })
  @Type(() => ItemMontagem3DDto)
  itens?: ItemMontagem3DDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => VentoinhaCompletaDto)
  ventoinhas?: VentoinhaCompletaDto[];
}
