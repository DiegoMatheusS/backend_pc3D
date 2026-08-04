import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarEspecificacaoMouseDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sensor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  dpiMaximo?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pollingRateHz?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  botoes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pesoGramas?: number;

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
  cabo?: boolean;

  @IsOptional()
  @IsBoolean()
  rgb?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mao?: string;
}
