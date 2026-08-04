import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AuthGuardOpcional } from '../auth/auth-guard-opcional.guard';
import { MontagensService } from './montagens.service';
import { CriarMontagemDto } from './dtos/criar-montagem.dto';
import { AtualizarMontagemDto } from './dtos/atualizar-montagem.dto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AcaoAuditoria } from '../generated/prisma/enums';

type ReqAuth = Request & { usuario: { id: number } };
type ReqAuthOpcional = Request & { usuario: { id: number } | null };

@ApiTags('Montagens')
@Controller('montagens')
export class MontagensController {
  constructor(
    private readonly montagensService: MontagensService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // ── Rotas públicas ────────────────────────────────────────────────────────

  @Get('publicas')
  listarPublicas() {
    return this.montagensService.listarPublicas();
  }

  @Get('slug/:slug')
  @UseGuards(AuthGuardOpcional)
  buscarPorSlug(@Param('slug') slug: string, @Req() req: ReqAuthOpcional) {
    return this.montagensService.buscarPorSlug(slug, req.usuario?.id);
  }

  // ── Rotas autenticadas ────────────────────────────────────────────────────

  @Get()
  @UseGuards(AuthGuard)
  listarMinhas(@Req() req: ReqAuth) {
    return this.montagensService.listarMinhas(req.usuario.id);
  }

  @Post()
  @UseGuards(AuthGuard)
  async criar(@Req() req: ReqAuth, @Body() dados: CriarMontagemDto) {
    const resultado = await this.montagensService.criar(req.usuario.id, dados);
    void this.auditoriaService.registrar({
      usuarioId: req.usuario.id,
      acao: AcaoAuditoria.MONTAGEM_CRIADA,
      entidade: 'Montagem',
      entidadeId: resultado.id,
      ip: req.ip,
    });
    return resultado;
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  buscarPorId(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) {
    return this.montagensService.buscarPorId(id, req.usuario.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ReqAuth,
    @Body() dados: AtualizarMontagemDto,
  ) {
    const resultado = await this.montagensService.atualizar(
      id,
      req.usuario.id,
      dados,
    );
    void this.auditoriaService.registrar({
      usuarioId: req.usuario.id,
      acao: AcaoAuditoria.MONTAGEM_ATUALIZADA,
      entidade: 'Montagem',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }

  @Post(':id/duplicar')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async duplicar(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) {
    const resultado = await this.montagensService.duplicar(id, req.usuario.id);
    void this.auditoriaService.registrar({
      usuarioId: req.usuario.id,
      acao: AcaoAuditoria.MONTAGEM_CRIADA,
      entidade: 'Montagem',
      entidadeId: resultado.id,
      dadosNovos: { origemMontagemId: id },
      ip: req.ip,
    });
    return resultado;
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async excluir(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) {
    const resultado = await this.montagensService.excluir(id, req.usuario.id);
    void this.auditoriaService.registrar({
      usuarioId: req.usuario.id,
      acao: AcaoAuditoria.MONTAGEM_REMOVIDA,
      entidade: 'Montagem',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }

  @Get(':id/resolver')
  @UseGuards(AuthGuard)
  resolver(@Param('id', ParseIntPipe) id: number, @Req() req: ReqAuth) {
    return this.montagensService.resolverMontagem(id, req.usuario.id);
  }
}
