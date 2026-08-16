import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class VerificarPrecosOfertasDto {
  /**
   * O verificador trabalha em lotes para não prender uma requisição por muito
   * tempo nem disparar dezenas de acessos externos simultaneamente.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite?: number;
}
