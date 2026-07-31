import {
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AlterarMinhaSenhaDto {
  @IsString({
    message: 'A senha atual deve ser um texto.',
  })
  @MinLength(8, {
    message: 'A senha atual deve ter pelo menos 8 caracteres.',
  })
  @MaxLength(128, {
    message: 'A senha atual deve ter no máximo 128 caracteres.',
  })
  senhaAtual!: string;

  @IsString({
    message: 'A nova senha deve ser um texto.',
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
        'A nova senha deve ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e símbolo.',
    },
  )
  @MaxLength(128, {
    message: 'A nova senha deve ter no máximo 128 caracteres.',
  })
  novaSenha!: string;
}
