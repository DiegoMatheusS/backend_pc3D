import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
<<<<<<< HEAD
  IsBoolean,
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsSafeJsonObject } from '../../common/validators/is-safe-json-object.validator';

export enum UsoPC {
  JOGOS = 'jogos',
  TRABALHO = 'trabalho',
  ESTUDIO = 'estudio',
  GERAL = 'geral',
}

export class MensagemHistoricoDto {
  @IsEnum(['usuario', 'assistente'])
  papel!: 'usuario' | 'assistente';

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  conteudo!: string;
}

export class ChatIaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  mensagem!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MensagemHistoricoDto)
  historico?: MensagemHistoricoDto[];

  @IsOptional()
  @IsObject()
  @IsSafeJsonObject({
    maxDepth: 6,
    maxKeys: 160,
    maxArrayLength: 64,
    maxStringLength: 4000,
  })
  buildAtual?: Record<string, unknown>;

  /**
   * ID de uma montagem salva. Quando informado, o backend
   * carrega os dados reais da montagem como contexto para a IA.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  montagemId?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100_000_000)
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
<<<<<<< HEAD

  /**
   * O Gemini só é acionado quando o frontend envia explicitamente true.
   * O fluxo padrão por botões permanece 100% local.
   */
  @IsOptional()
  @IsBoolean()
  usarGemini?: boolean;
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
}
