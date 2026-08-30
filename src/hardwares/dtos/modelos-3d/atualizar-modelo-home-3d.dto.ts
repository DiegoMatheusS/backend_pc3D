import { IsBoolean } from 'class-validator';

export class AtualizarModeloHome3DDto {
  @IsBoolean()
  mostrarNoHome!: boolean;
}
