import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadModelo3DHardwareDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string;

  /**
   * Caminho opcional dentro do bucket. Se omitido, o backend usa a pasta da
   * categoria do hardware e preserva o nome do arquivo enviado.
   * Exemplo: modelos/gpu/rtx_4060.glb
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string;

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
}
