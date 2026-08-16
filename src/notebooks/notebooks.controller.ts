import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Papeis } from '../auth/papeis.decorator';
import { PapelGuard } from '../auth/papel.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AcaoAuditoria, PapelUsuario } from '../generated/prisma/enums';
import { AtualizarNotebookDto } from './dtos/atualizar-notebook.dto';
import { CriarNotebookDto } from './dtos/criar-notebook.dto';
import { FiltrarNotebooksDto } from './dtos/filtrar-notebooks.dto';
import { NotebooksService } from './notebooks.service';

type UsuarioReq = { id: number; papel: string } | null;

@ApiTags('Notebooks')
@Controller('notebooks')
export class NotebooksController {
  constructor(private readonly notebooksService: NotebooksService) {}

  @Get()
  listar(@Query() filtros: FiltrarNotebooksDto) {
    return this.notebooksService.listarPublicos(filtros);
  }

  @Get(':id')
  buscar(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.notebooksService.buscarPublico(id);
  }
}

@ApiTags('Notebooks Admin')
@Controller('admin/notebooks')
@UseGuards(AuthGuard, PapelGuard)
export class NotebooksAdminController {
  constructor(
    private readonly notebooksService: NotebooksService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listar() {
    return this.notebooksService.listarAdmin();
  }

  @Post()
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async criar(
    @Body() dados: CriarNotebookDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.notebooksService.criar(dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.NOTEBOOK_CRIADO,
      entidade: 'Notebook',
      entidadeId: resultado.id,
      ip: req.ip,
    });
    return resultado;
  }

  @Get(':id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  buscar(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.notebooksService.buscarAdmin(id);
  }

  @Patch(':id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async atualizar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: AtualizarNotebookDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.notebooksService.atualizar(id, dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.NOTEBOOK_ATUALIZADO,
      entidade: 'Notebook',
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
    const resultado = await this.notebooksService.arquivar(id);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.NOTEBOOK_REMOVIDO,
      entidade: 'Notebook',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }
}
