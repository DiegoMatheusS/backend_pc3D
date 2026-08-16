import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
<<<<<<< HEAD
  IsBoolean,
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
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
<<<<<<< HEAD

  @IsOptional()
  @IsBoolean()
  usarGemini?: boolean;
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
}
