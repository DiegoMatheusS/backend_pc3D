import { IsInt, Max, Min } from 'class-validator';

export class AvaliarBuildComunidadeDto {
  @IsInt()
  @Min(1)
  @Max(5)
  nota!: number;
}
