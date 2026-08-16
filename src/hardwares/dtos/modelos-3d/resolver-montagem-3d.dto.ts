import { Type } from 'class-transformer';
import {
  Max,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemMontagem3DDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  instanciaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  instanciaPaiId?: string;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  pontoEncaixeId!: number;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  hardwareFilhoId!: number;
}

export class ResolverMontagem3DDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(128)
  @ValidateNested({ each: true })
  @Type(() => ItemMontagem3DDto)
  itens!: ItemMontagem3DDto[];
}
