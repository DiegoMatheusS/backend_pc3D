import { IsBoolean } from 'class-validator';

export class AtualizarStatusModelo3DDto {
  @IsBoolean()
  ativo!: boolean;
}
