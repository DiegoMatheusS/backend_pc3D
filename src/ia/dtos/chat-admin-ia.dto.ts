import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MensagemHistoricoDto } from './chat-ia.dto';

export class ChatAdminIaDto {
  @IsString()
  @MaxLength(1000)
  mensagem: string;

  @IsOptional()
  @IsArray()
  historico?: MensagemHistoricoDto[];

  @IsOptional()
  @IsObject()
  contexto?: Record<string, unknown>;
}
