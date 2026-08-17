import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Credential JWT retornada pelo Google Identity Services no frontend.
 * O token é validado criptograficamente no backend antes de qualquer login.
 */
export class GoogleAuthDto {
  @IsString({ message: 'A credencial do Google deve ser um texto.' })
  @MinLength(20, { message: 'Credencial do Google inválida.' })
  @MaxLength(10_000, { message: 'Credencial do Google inválida.' })
  credential!: string;
}
