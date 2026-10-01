import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PapelGuard } from '../auth/papel.guard';
import { Papeis } from '../auth/papeis.decorator';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AcaoAuditoria, PapelUsuario } from '../generated/prisma/enums';
import { IaService } from './ia.service';
import {
  AnalisarProdutoIaDto,
  GerarDescricaoIaDto,
  NormalizarProdutoIaDto,
} from './dtos/analisar-produto-ia.dto';
import { ChatAdminIaDto } from './dtos/chat-admin-ia.dto';
import { ImportarLinkIaDto } from './dtos/importar-link-ia.dto';

type UsuarioReq = { id: number; papel: string } | null;

@ApiTags('IA Admin')
@Controller('admin/ia')
@Throttle({ global: { limit: 15, ttl: 60_000 } })
@UseGuards(AuthGuard, PapelGuard)
export class IaAdminController {
  constructor(
    private readonly iaService: IaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private registrarUso(
    usuarioId: number | undefined,
    operacao: string,
    req: Request,
  ) {
    void this.auditoriaService.registrar({
      usuarioId,
      acao: AcaoAuditoria.IA_ADMIN_UTILIZADA,
      entidade: 'IAAdmin',
      entidadeId: operacao,
      dadosNovos: { operacao },
      ip: req.ip,
    });
  }

  @Get('menu')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  menu(@UsuarioAtual() usuario: UsuarioReq) {
    return this.iaService.menuAdmin(usuario?.papel);
  }

  @Post('chat')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body() dados: ChatAdminIaDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.iaService.chatAdmin(dados);
    this.registrarUso(usuario?.id, 'CHAT_ADMIN', req);
    return resultado;
  }

  @Post('importar-link')
  @Papeis(PapelUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  async importarLink(
    @Body() dados: ImportarLinkIaDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const normalizado: ImportarLinkIaDto = {
      ...dados,
      categoriaEsperada: dados.categoriaEsperada ?? dados.categoria,
    };
    const resultado = await this.iaService.importarLinkAdmin(normalizado);
    this.registrarUso(usuario?.id, 'IMPORTAR_LINK', req);
    return resultado;
  }

  @Post('analisar-produto')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  @HttpCode(HttpStatus.OK)
  async analisarProduto(
    @Body() dados: AnalisarProdutoIaDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.iaService.analisarProduto(dados);
    this.registrarUso(usuario?.id, 'ANALISAR_PRODUTO', req);
    return resultado;
  }

  @Post('normalizar-produto')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  @HttpCode(HttpStatus.OK)
  async normalizarProduto(
    @Body() dados: NormalizarProdutoIaDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.iaService.normalizarProduto(dados);
    this.registrarUso(usuario?.id, 'NORMALIZAR_PRODUTO', req);
    return resultado;
  }

  @Post('gerar-descricao')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  @HttpCode(HttpStatus.OK)
  async gerarDescricao(
    @Body() dados: GerarDescricaoIaDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.iaService.gerarDescricao(dados);
    this.registrarUso(usuario?.id, 'GERAR_DESCRICAO', req);
    return resultado;
  }
}
