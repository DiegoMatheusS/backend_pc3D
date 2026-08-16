import {
  IsEmail,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Criação de uma nova conta pelo painel administrativo.
 * Toda conta nasce como USUARIO; promoção de papel acontece depois,
 * exclusivamente pela rota administrativa de atualização.
 */
export class CriarUsuarioDto {
  @IsString({
    message: 'O nome deve ser um texto.',
  })
  @MinLength(2, {
    message: 'O nome deve ter pelo menos 2 caracteres.',
  })
  @MaxLength(150, {
    message: 'O nome deve ter no máximo 150 caracteres.',
  })
  nome!: string;

  @IsEmail(
    {},
    {
      message: 'Informe um e-mail válido.',
    },
  )
  @MaxLength(255, {
    message: 'O e-mail deve ter no máximo 255 caracteres.',
  })
  email!: string;

  @IsString({
    message: 'A senha deve ser um texto.',
  })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'A senha deve ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e símbolo.',
    },
  )
  @MaxLength(128, {
    message: 'A senha deve ter no máximo 128 caracteres.',
  })
  senha!: string;
}
