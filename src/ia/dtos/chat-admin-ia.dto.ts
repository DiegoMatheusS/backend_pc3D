import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsSafeJsonObject } from '../../common/validators/is-safe-json-object.validator';
import { MensagemHistoricoDto } from './chat-ia.dto';

export class ChatAdminIaDto {
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
    maxKeys: 200,
    maxArrayLength: 64,
    maxStringLength: 10_000,
  })
  contexto?: Record<string, unknown>;
}
