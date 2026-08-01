import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import {
  ChaveM2,
  FormatoArmazenamento,
  InterfaceArmazenamento,
  TipoArmazenamento,
} from '../../../generated/prisma/enums';

export class CriarEspecificacaoArmazenamentoDto {
  @IsEnum(TipoArmazenamento, {
    message: 'Informe um tipo de armazenamento válido.',
  })
  tipo!: TipoArmazenamento;

  @IsEnum(FormatoArmazenamento, {
    message: 'Informe um formato de armazenamento válido.',
  })
  formato!: FormatoArmazenamento;

  @IsEnum(InterfaceArmazenamento, {
    message: 'Informe uma interface de armazenamento válida.',
  })
  interface!: InterfaceArmazenamento;

  @IsInt()
  @Min(1)
  capacidadeGb!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  tamanhoM2Mm?: number;

  @IsOptional()
  @IsEnum(ChaveM2, {
    message: 'Informe uma chave M.2 válida.',
  })
  chaveM2?: ChaveM2;

  @IsOptional()
  @IsInt()
  @Min(1)
  geracaoPcie?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pistasPcie?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  leituraSequencialMbps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  escritaSequencialMbps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  alturaMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  larguraMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  profundidadeMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  espessuraMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consumoWatts?: number;

  @IsOptional()
  @IsBoolean()
  possuiDissipador?: boolean;
}
