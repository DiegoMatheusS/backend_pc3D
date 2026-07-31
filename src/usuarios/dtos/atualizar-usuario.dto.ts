import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PapelUsuario } from '../../generated/prisma/enums';

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsString({
    message: 'O nome deve ser um texto.',
  })
  @MinLength(2, {
    message: 'O nome deve ter pelo menos 2 caracteres.',
  })
  @MaxLength(150, {
    message: 'O nome deve ter no máximo 150 caracteres.',
  })
  nome?: string;

  @IsOptional()
  @IsEmail(
    {},
    {
      message: 'Informe um e-mail válido.',
    },
  )
  @MaxLength(255, {
    message: 'O e-mail deve ter no máximo 255 caracteres.',
  })
  email?: string;

  @IsOptional()
  @IsEnum(PapelUsuario, {
    message: 'O papel deve ser ADMIN, EDITOR, REVISOR ou USUARIO.',
  })
  papel?: PapelUsuario;

  @IsOptional()
  @IsBoolean({
    message: 'O campo ativo deve ser verdadeiro ou falso.',
  })
  ativo?: boolean;
}
