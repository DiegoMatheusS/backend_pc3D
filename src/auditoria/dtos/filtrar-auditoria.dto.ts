import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AcaoAuditoria } from '../../generated/prisma/enums';

export class FiltrarAuditoriaDto {
  @IsOptional()
  @IsEnum(AcaoAuditoria)
  acao?: AcaoAuditoria;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entidadeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  usuarioId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  porPagina?: number;
}
