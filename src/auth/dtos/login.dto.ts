import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail(
    {},
    {
      message: 'Informe um e-mail válido.',
    },
  )
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, {
    message: 'A senha deve ter pelo menos 8 caracteres.',
  })
  @MaxLength(128)
  senha!: string;
}
