import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';

export const PROVEDORES_IA_TECNICA = [
  'PROJETO_IA',
  'GEMINI',
  'META_AI',
  'OPENAI',
  'OUTRO',
] as const;

export type ProvedorIaTecnica = (typeof PROVEDORES_IA_TECNICA)[number];

export class EnriquecerIaTecnicaDto {
  @IsIn([...PROVEDORES_IA_TECNICA])
  provedor!: ProvedorIaTecnica;

  @IsEnum(CategoriaHardware)
  categoria!: CategoriaHardware;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nome?: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  somentePreencheLacunas?: boolean;
}
