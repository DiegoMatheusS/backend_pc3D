import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ChaveM2,
  InterfaceArmazenamento,
} from '../../../generated/prisma/enums';

export class CriarSlotM2PlacaMaeDto {
  @IsString()
  @MaxLength(50)
  codigo!: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(InterfaceArmazenamento, { each: true })
  interfacesSuportadas!: InterfaceArmazenamento[];

  @IsArray()
  @ArrayUnique()
  @IsEnum(ChaveM2, { each: true })
  chavesSuportadas!: ChaveM2[];

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  tamanhosSuportadosMm!: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  geracaoPcieMaxima?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pistasPcie?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  compartilhaCom?: string;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
