import { IsInt, Max, Min } from 'class-validator';

export class AceitarOfertaExistenteDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  produtoId!: number;
}
