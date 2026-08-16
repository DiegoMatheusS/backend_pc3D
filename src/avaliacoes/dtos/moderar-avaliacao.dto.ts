import { IsEnum } from 'class-validator';
import { StatusAvaliacao } from '../../generated/prisma/enums';

export class ModerarAvaliacaoDto {
  @IsEnum(StatusAvaliacao)
  status!: StatusAvaliacao;
}
