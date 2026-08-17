import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AcaoAuditoria, PapelUsuario } from '../generated/prisma/enums';
import { AuthGuard } from '../auth/auth.guard';
import { PapelGuard } from '../auth/papel.guard';
import { Papeis } from '../auth/papeis.decorator';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { AceitarOfertaExistenteDto } from './dtos/aceitar-oferta-existente.dto';
import { AprovarSugestaoOfertaDto } from './dtos/aprovar-sugestao-oferta.dto';
import { CriarSugestaoOfertaDto } from './dtos/criar-sugestao-oferta.dto';
import { RejeitarSugestaoOfertaDto } from './dtos/rejeitar-sugestao-oferta.dto';
import { SugestoesOfertasService } from './sugestoes-ofertas.service';

type UsuarioReq = { id: number; papel: PapelUsuario } | null;

@ApiTags('Sugestões de Ofertas')
@Controller('ofertas/sugestoes')
@UseGuards(AuthGuard)
export class SugestoesOfertasController {
  constructor(private readonly sugestoesService: SugestoesOfertasService) {}

  private exigirUsuario(usuario: UsuarioReq) {
    if (!usuario) throw new UnauthorizedException('Sessão não encontrada.');
    return usuario;
  }

  @Get('campos')
  obterFormulario() {
    return this.sugestoesService.obterFormulario();
  }

  @Post()
  @Throttle({ global: { limit: 5, ttl: 60_000 } })
  criar(
    @Body() dados: CriarSugestaoOfertaDto,
    @UsuarioAtual() usuario: UsuarioReq,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    return this.sugestoesService.criar(autenticado.id, dados);
  }

  @Get('minhas')
  listarMinhas(@UsuarioAtual() usuario: UsuarioReq) {
    const autenticado = this.exigirUsuario(usuario);
    return this.sugestoesService.listarMinhas(autenticado.id);
  }

  @Get('minhas/:id')
  buscarMinha(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioReq,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    return this.sugestoesService.buscarMinha(autenticado.id, id);
  }
}

@ApiTags('Sugestões de Ofertas — Admin')
@Controller('admin/ofertas/sugestoes')
@UseGuards(AuthGuard, PapelGuard)
@Papeis(PapelUsuario.ADMIN)
export class SugestoesOfertasAdminController {
  constructor(
    private readonly sugestoesService: SugestoesOfertasService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private exigirUsuario(usuario: UsuarioReq) {
    if (!usuario) throw new UnauthorizedException('Sessão não encontrada.');
    return usuario;
  }

  @Get(':id')
  buscar(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.sugestoesService.buscarAdmin(id);
  }

  @Patch(':id/aprovar')
  async aprovar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: AprovarSugestaoOfertaDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    const resultado = await this.sugestoesService.aprovar(
      id,
      autenticado.id,
      dados,
    );
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.OFERTA_CRIADA,
      entidade: 'SugestaoOferta',
      entidadeId: id,
      dadosNovos: {
        status: 'APROVADA',
        ofertaId: resultado.oferta.id,
        produtoId: resultado.oferta.produtoId,
        parceiroId: resultado.oferta.parceiroId,
      },
      ip: req.ip,
    });
    return resultado;
  }

  @Patch(':id/aceitar-existente')
  async aceitarExistente(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: AceitarOfertaExistenteDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    const resultado = await this.sugestoesService.aceitarExistente(
      id,
      autenticado.id,
      dados,
    );
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.OFERTA_ATUALIZADA,
      entidade: 'SugestaoOferta',
      entidadeId: id,
      dadosNovos: {
        status: 'APROVADA',
        ofertaId: resultado.oferta?.id ?? null,
        produtoId: resultado.oferta?.produtoId ?? dados.produtoId,
        origem: 'OFERTA_EXISTENTE',
      },
      ip: req.ip,
    });
    return resultado;
  }

  @Patch(':id/rejeitar')
  async rejeitar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: RejeitarSugestaoOfertaDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    const resultado = await this.sugestoesService.rejeitar(
      id,
      autenticado.id,
      dados.motivo,
    );
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.OFERTA_ATUALIZADA,
      entidade: 'SugestaoOferta',
      entidadeId: id,
      dadosNovos: { status: 'REJEITADA', motivo: dados.motivo },
      ip: req.ip,
    });
    return resultado;
  }
}
