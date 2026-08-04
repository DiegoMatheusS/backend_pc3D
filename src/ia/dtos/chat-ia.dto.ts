import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum UsoPC {
  JOGOS = 'jogos',
  TRABALHO = 'trabalho',
  ESTUDIO = 'estudio',
  GERAL = 'geral',
}

export class MensagemHistoricoDto {
  @IsEnum(['usuario', 'assistente'])
  papel: 'usuario' | 'assistente';

  @IsString()
  @MaxLength(4000)
  conteudo: string;
}

export class ChatIaDto {
  @IsString()
  @MaxLength(1000)
  mensagem: string;

  @IsOptional()
  @IsArray()
  historico?: MensagemHistoricoDto[];

  @IsOptional()
  @IsObject()
  buildAtual?: Record<string, unknown>;

  /**
   * ID de uma montagem salva. Quando informado, o backend
   * carrega os dados reais da montagem como contexto para a IA.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  montagemId?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  orcamento?: number;

  @IsOptional()
  @IsEnum(UsoPC)
  uso?: UsoPC;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  resolucao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferencia?: string;
}
