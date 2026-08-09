import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ItemMontagem3DDto } from '../../hardwares/dtos/modelos-3d/resolver-montagem-3d.dto';
import { VentoinhaCompletaDto } from '../../hardwares/dtos/modelos-3d/resolver-montagem-completa.dto';

export class CriarMontagemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  gabineteId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  fonteId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  coolerId?: number;

  @IsOptional()
  @IsBoolean()
  publico?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(128)
  @ValidateNested({ each: true })
  @Type(() => ItemMontagem3DDto)
  itens!: ItemMontagem3DDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => VentoinhaCompletaDto)
  ventoinhas?: VentoinhaCompletaDto[];
}
