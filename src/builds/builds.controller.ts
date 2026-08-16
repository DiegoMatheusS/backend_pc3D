import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Papeis } from '../auth/papeis.decorator';
import { PapelGuard } from '../auth/papel.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AcaoAuditoria, PapelUsuario } from '../generated/prisma/enums';
import { AtualizarBuildDto } from './dtos/atualizar-build.dto';
import { CriarBuildDto } from './dtos/criar-build.dto';
import { FiltrarBuildsDto } from './dtos/filtrar-builds.dto';
import { BuildsService } from './builds.service';

type UsuarioReq = { id: number; papel: string } | null;

@ApiTags('PCs Montados')
@Controller('builds')
export class BuildsController {
  constructor(private readonly buildsService: BuildsService) {}

  @Get()
  listar(@Query() filtros: FiltrarBuildsDto) {
    return this.buildsService.listarPublicos(filtros);
  }

  @Get(':id/3d')
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  abrirNo3D(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.buildsService.abrirNo3D(id);
  }

  @Get(':id/resumo-compra')
  @Throttle({ global: { limit: 60, ttl: 60_000 } })
  resumoCompra(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.buildsService.resumoCompra(id);
  }

  @Get(':id')
  buscar(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.buildsService.buscarPublico(id);
  }
}

@ApiTags('PCs Montados Admin')
@Controller('admin/builds')
@UseGuards(AuthGuard, PapelGuard)
export class BuildsAdminController {
  constructor(
    private readonly buildsService: BuildsService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listar() {
    return this.buildsService.listarAdmin();
  }

  @Get(':id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  buscar(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.buildsService.buscarAdmin(id);
  }

  @Post()
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async criar(
    @Body() dados: CriarBuildDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.buildsService.criar(dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.BUILD_CRIADA,
      entidade: 'Build',
      entidadeId: resultado.id,
      ip: req.ip,
    });
    return resultado;
  }

  @Patch(':id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async atualizar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: AtualizarBuildDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.buildsService.atualizar(id, dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.BUILD_ATUALIZADA,
      entidade: 'Build',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Papeis(PapelUsuario.ADMIN)
  async arquivar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.buildsService.arquivar(id);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.BUILD_REMOVIDA,
      entidade: 'Build',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }
}
