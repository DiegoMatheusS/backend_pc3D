import {
  Max,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { IsSafeResourceUrl } from '../../../common/validators/is-safe-resource-url.validator';
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
  @IsSafeResourceUrl()
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
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    disallow_auth: true,
  })
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
  @Max(1_000_000)
  alturaRealMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  larguraRealMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  profundidadeRealMm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  tamanhoBytes?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoCorrecaoX?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoCorrecaoY?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  posicaoCorrecaoZ?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoCorrecaoX?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoCorrecaoY?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  rotacaoCorrecaoZ?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaCorrecaoX?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaCorrecaoY?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  escalaCorrecaoZ?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
