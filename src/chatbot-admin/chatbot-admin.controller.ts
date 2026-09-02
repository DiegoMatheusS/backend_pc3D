import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthGuard } from '../auth/auth.guard';
import { PapelGuard } from '../auth/papel.guard';
import { Papeis } from '../auth/papeis.decorator';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { AcaoAuditoria, PapelUsuario } from '../generated/prisma/enums';
import { ChatbotAdminService } from './chatbot-admin.service';
import { AnalisarCadastroChatbotDto } from './dtos/analisar-cadastro-chatbot.dto';
import { ConfirmarCadastroChatbotDto } from './dtos/confirmar-cadastro-chatbot.dto';

type UsuarioReq = { id: number; papel: PapelUsuario } | null;

@ApiTags('Chatbot Admin')
@Controller('admin/chatbot')
@UseGuards(AuthGuard, PapelGuard)
@Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
@Throttle({ global: { limit: 12, ttl: 60_000 } })
export class ChatbotAdminController {
  constructor(
    private readonly chatbotService: ChatbotAdminService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private exigirUsuario(usuario: UsuarioReq) {
    if (!usuario) throw new UnauthorizedException('Sessão não encontrada.');
    return usuario;
  }

  @Post('analisar-cadastro')
  @HttpCode(HttpStatus.OK)
  async analisar(
    @Body() dados: AnalisarCadastroChatbotDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    const resultado = await this.chatbotService.analisarCadastro(
      autenticado.id,
      dados,
    );

    void this.auditoriaService.registrar({
      usuarioId: autenticado.id,
      acao: AcaoAuditoria.IA_ADMIN_UTILIZADA,
      entidade: 'ChatbotCadastro',
      entidadeId: resultado.tokenConfirmacao,
      dadosNovos: {
        operacao: 'ANALISAR_CADASTRO',
        acao: dados.acao,
        categoria: resultado.analise.categoria,
        nenhumRegistroCriado: true,
      },
      ip: req.ip,
    });

    return resultado;
  }

  @Post('confirmar-cadastro')
  @HttpCode(HttpStatus.OK)
  async confirmar(
    @Body() dados: ConfirmarCadastroChatbotDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    const resultado = await this.chatbotService.confirmarCadastro(
      autenticado.id,
      dados,
    );

    void this.auditoriaService.registrar({
      usuarioId: autenticado.id,
      acao: AcaoAuditoria.IA_ADMIN_UTILIZADA,
      entidade: 'ChatbotCadastro',
      entidadeId: dados.tokenConfirmacao,
      dadosNovos: {
        operacao: dados.confirmar ? 'CONFIRMAR_CADASTRO' : 'CANCELAR_CADASTRO',
        status: resultado.status,
      },
      ip: req.ip,
    });

    return resultado;
  }
}
