import {
  Max,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarAjusteEncaixeHardwareDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  hardwareFilhoId!: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoX?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoY?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoZ?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoX?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoY?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoZ?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaX?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaY?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaZ?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;

  @IsOptional()
  @IsBoolean()
  revisado?: boolean;
}
