import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CriarEspecificacaoTecladoDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  layout?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  switch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tamanho?: string;

  @IsOptional()
  @IsBoolean()
  abnt2?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  conexao?: string;

  @IsOptional()
  @IsBoolean()
  bluetooth?: boolean;

  @IsOptional()
  @IsBoolean()
  wireless?: boolean;

  @IsOptional()
  @IsBoolean()
  usb?: boolean;

  @IsOptional()
  @IsBoolean()
  rgb?: boolean;

  @IsOptional()
  @IsBoolean()
  hotSwap?: boolean;
}
