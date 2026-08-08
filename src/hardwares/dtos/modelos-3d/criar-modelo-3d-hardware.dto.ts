import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  FormatoModelo3D,
  OrigemModelo3D,
} from '../../../generated/prisma/enums';

export class CriarModelo3DHardwareDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string;

  /**
   * URL do arquivo 3D. Pode apontar para storage/CDN próprio ou para uma
   * origem externa. O arquivo não é armazenado no PostgreSQL.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  arquivoUrl!: string;

  @IsEnum(FormatoModelo3D)
  formato!: FormatoModelo3D;

  @IsOptional()
  @IsEnum(OrigemModelo3D)
  origem?: OrigemModelo3D;

  /** Chave/caminho interno no object storage quando origem = PROPRIO. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string;

  /** Página/fonte de onde veio o modelo quando origem = EXTERNO. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fonteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  autor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  licenca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  versao?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  alturaRealMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  larguraRealMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  profundidadeRealMm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tamanhoBytes?: number;

  @IsOptional()
  @IsNumber()
  posicaoCorrecaoX?: number;

  @IsOptional()
  @IsNumber()
  posicaoCorrecaoY?: number;

  @IsOptional()
  @IsNumber()
  posicaoCorrecaoZ?: number;

  @IsOptional()
  @IsNumber()
  rotacaoCorrecaoX?: number;

  @IsOptional()
  @IsNumber()
  rotacaoCorrecaoY?: number;

  @IsOptional()
  @IsNumber()
  rotacaoCorrecaoZ?: number;

  @IsOptional()
  @IsNumber()
  escalaCorrecaoX?: number;

  @IsOptional()
  @IsNumber()
  escalaCorrecaoY?: number;

  @IsOptional()
  @IsNumber()
  escalaCorrecaoZ?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
