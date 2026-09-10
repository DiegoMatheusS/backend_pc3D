import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';

export class EnriquecerMetaAiWhatsappDto {
  @IsEnum(CategoriaHardware)
  categoria!: CategoriaHardware;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nome?: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(30_000)
  resposta?: string;

  @IsOptional()
  @IsObject()
  captura?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  forcar?: boolean;
}
