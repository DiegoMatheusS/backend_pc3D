import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemMontagem3DDto {
  @IsInt()
  @Min(1)
  pontoEncaixeId!: number;

  @IsInt()
  @Min(1)
  hardwareFilhoId!: number;
}

export class ResolverMontagem3DDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemMontagem3DDto)
  itens!: ItemMontagem3DDto[];
}
