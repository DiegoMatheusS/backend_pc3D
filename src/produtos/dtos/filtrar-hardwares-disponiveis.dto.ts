import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FiltrarHardwaresDisponiveisDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busca?: string;
}
