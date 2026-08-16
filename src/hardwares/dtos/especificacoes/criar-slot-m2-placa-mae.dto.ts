import {
  Max,
  ArrayMaxSize,
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
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsEnum(InterfaceArmazenamento, { each: true })
  interfacesSuportadas!: InterfaceArmazenamento[];

  @IsArray()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsEnum(ChaveM2, { each: true })
  chavesSuportadas!: ChaveM2[];

  @IsArray()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(1_000_000, { each: true })
  tamanhosSuportadosMm!: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  geracaoPcieMaxima?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  pistasPcie?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  compartilhaCom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
