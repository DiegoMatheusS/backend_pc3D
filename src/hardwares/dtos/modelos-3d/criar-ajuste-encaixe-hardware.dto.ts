import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CriarAjusteEncaixeHardwareDto {
  @IsInt()
  @Min(1)
  hardwareFilhoId!: number;

  @IsOptional()
  @IsNumber()
  posicaoX?: number;

  @IsOptional()
  @IsNumber()
  posicaoY?: number;

  @IsOptional()
  @IsNumber()
  posicaoZ?: number;

  @IsOptional()
  @IsNumber()
  rotacaoX?: number;

  @IsOptional()
  @IsNumber()
  rotacaoY?: number;

  @IsOptional()
  @IsNumber()
  rotacaoZ?: number;

  @IsOptional()
  @IsNumber()
  escalaX?: number;

  @IsOptional()
  @IsNumber()
  escalaY?: number;

  @IsOptional()
  @IsNumber()
  escalaZ?: number;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsBoolean()
  revisado?: boolean;
}
