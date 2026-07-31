import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CategoriaHardware } from '../../generated/prisma/enums';

export class CriarHardwareDto {
  @IsString({
    message: 'O nome deve ser um texto.',
  })
  @MinLength(2, {
    message: 'O nome deve ter pelo menos 2 caracteres.',
  })
  @MaxLength(200, {
    message: 'O nome deve ter no máximo 200 caracteres.',
  })
  nome!: string;

  @IsEnum(CategoriaHardware, {
    message: 'Informe uma categoria de hardware válida.',
  })
  categoria!: CategoriaHardware;

  @IsString({
    message: 'A marca deve ser um texto.',
  })
  @MinLength(1, {
    message: 'Informe a marca.',
  })
  @MaxLength(100, {
    message: 'A marca deve ter no máximo 100 caracteres.',
  })
  marca!: string;

  @IsString({
    message: 'O modelo deve ser um texto.',
  })
  @MinLength(1, {
    message: 'Informe o modelo.',
  })
  @MaxLength(150, {
    message: 'O modelo deve ter no máximo 150 caracteres.',
  })
  modelo!: string;

  @IsOptional()
  @IsString({
    message: 'A descrição deve ser um texto.',
  })
  descricao?: string;

  @IsOptional()
  @IsString({
    message: 'A URL da imagem deve ser um texto.',
  })
  @MaxLength(500, {
    message: 'A URL da imagem deve ter no máximo 500 caracteres.',
  })
  imagemUrl?: string;

  @IsOptional()
  @IsObject({
    message: 'As especificações devem ser um objeto.',
  })
  especificacoes?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean({
    message: 'O campo publicado deve ser verdadeiro ou falso.',
  })
  publicado?: boolean;

  @IsOptional()
  @IsBoolean({
    message: 'O campo ativo deve ser verdadeiro ou falso.',
  })
  ativo?: boolean;
}
