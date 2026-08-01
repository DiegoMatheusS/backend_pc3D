import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class AtualizarAjusteEncaixeHardwareDto {
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
