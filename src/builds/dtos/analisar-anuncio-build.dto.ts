import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalisarAnuncioBuildDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30000)
  descricao?: string;
}
