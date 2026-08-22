import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AtualizarMeuPerfilDto {
  @IsOptional()
  @IsString({ message: 'O nome deve ser um texto.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(150, { message: 'O nome deve ter no máximo 150 caracteres.' })
  nome?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(255, { message: 'O e-mail deve ter no máximo 255 caracteres.' })
  email?: string;

  /** Necessária quando a conta local altera o próprio e-mail. */
  @IsOptional()
  @IsString({ message: 'A senha atual deve ser um texto.' })
  @MinLength(8, { message: 'A senha atual deve ter pelo menos 8 caracteres.' })
  @MaxLength(128, {
    message: 'A senha atual deve ter no máximo 128 caracteres.',
  })
  senhaAtual?: string;

  /** Alternativa à senha para contas já vinculadas ao Google. */
  @IsOptional()
  @IsString({ message: 'A credencial Google deve ser um texto.' })
  @MinLength(20, { message: 'A credencial Google é inválida.' })
  @MaxLength(8_192, { message: 'A credencial Google é grande demais.' })
  googleCredential?: string;
}
