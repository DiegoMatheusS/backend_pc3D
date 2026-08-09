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
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Papeis } from '../auth/papeis.decorator';
import { PapelGuard } from '../auth/papel.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AcaoAuditoria, PapelUsuario } from '../generated/prisma/enums';
import { AtualizarAvaliacaoDto } from './dtos/atualizar-avaliacao.dto';
import { CriarAvaliacaoDto } from './dtos/criar-avaliacao.dto';
import { FiltrarAvaliacoesDto } from './dtos/filtrar-avaliacoes.dto';
import { ModerarAvaliacaoDto } from './dtos/moderar-avaliacao.dto';
import { AvaliacoesService } from './avaliacoes.service';

type ReqAuth = Request & { usuario: { id: number } };
type UsuarioReq = { id: number; papel: string } | null;

@ApiTags('Avaliações')
@Controller('produtos/:produtoId/avaliacoes')
export class ProdutosAvaliacoesController {
  constructor(private readonly avaliacoesService: AvaliacoesService) {}

  @Get()
  listar(
    @Param('produtoId', ParsePositiveIntPipe) produtoId: number,
    @Query() filtros: FiltrarAvaliacoesDto,
  ) {
    return this.avaliacoesService.listar(produtoId, filtros);
  }

  @Post()
  @UseGuards(AuthGuard)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  criar(
    @Param('produtoId', ParsePositiveIntPipe) produtoId: number,
    @Req() req: ReqAuth,
    @Body() dados: CriarAvaliacaoDto,
  ) {
    return this.avaliacoesService.criarOuAtualizar(
      produtoId,
      req.usuario.id,
      dados,
    );
  }
}

@ApiTags('Avaliações')
@Controller('avaliacoes')
export class AvaliacoesController {
  constructor(
    private readonly avaliacoesService: AvaliacoesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Patch(':id')
  @UseGuards(AuthGuard)
  atualizar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Req() req: ReqAuth,
    @Body() dados: AtualizarAvaliacaoDto,
  ) {
    return this.avaliacoesService.atualizar(id, req.usuario.id, dados);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  excluir(@Param('id', ParsePositiveIntPipe) id: number, @Req() req: ReqAuth) {
    return this.avaliacoesService.excluir(id, req.usuario.id);
  }

  @Patch(':id/moderar')
  @UseGuards(AuthGuard, PapelGuard)
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.REVISOR)
  async moderar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: ModerarAvaliacaoDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.avaliacoesService.moderar(id, dados.status);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.AVALIACAO_MODERADA,
      entidade: 'Avaliacao',
      entidadeId: id,
      dadosNovos: { status: dados.status },
      ip: req.ip,
    });
    return resultado;
  }
}

abstract class AvaliacoesAliasBase {
  constructor(protected readonly avaliacoesService: AvaliacoesService) {}

  protected listarProduto(produtoId: number, filtros: FiltrarAvaliacoesDto) {
    return this.avaliacoesService.listar(produtoId, filtros);
  }

  protected criarProduto(
    produtoId: number,
    usuarioId: number,
    dados: CriarAvaliacaoDto,
  ) {
    return this.avaliacoesService.criarOuAtualizar(produtoId, usuarioId, dados);
  }
}

@ApiTags('Avaliações')
@Controller('hardwares/:hardwareId/avaliacoes')
export class HardwaresAvaliacoesController extends AvaliacoesAliasBase {
  constructor(avaliacoesService: AvaliacoesService) {
    super(avaliacoesService);
  }

  @Get()
  async listar(
    @Param('hardwareId', ParsePositiveIntPipe) hardwareId: number,
    @Query() filtros: FiltrarAvaliacoesDto,
  ) {
    const produtoId =
      await this.avaliacoesService.produtoIdPorHardware(hardwareId);
    return this.listarProduto(produtoId, filtros);
  }

  @Post()
  @UseGuards(AuthGuard)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  async criar(
    @Param('hardwareId', ParsePositiveIntPipe) hardwareId: number,
    @Req() req: ReqAuth,
    @Body() dados: CriarAvaliacaoDto,
  ) {
    const produtoId =
      await this.avaliacoesService.produtoIdPorHardware(hardwareId);
    return this.criarProduto(produtoId, req.usuario.id, dados);
  }
}

@ApiTags('Avaliações')
@Controller('notebooks/:notebookId/avaliacoes')
export class NotebooksAvaliacoesController extends AvaliacoesAliasBase {
  constructor(avaliacoesService: AvaliacoesService) {
    super(avaliacoesService);
  }

  @Get()
  async listar(
    @Param('notebookId', ParsePositiveIntPipe) notebookId: number,
    @Query() filtros: FiltrarAvaliacoesDto,
  ) {
    const produtoId =
      await this.avaliacoesService.produtoIdPorNotebook(notebookId);
    return this.listarProduto(produtoId, filtros);
  }

  @Post()
  @UseGuards(AuthGuard)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  async criar(
    @Param('notebookId', ParsePositiveIntPipe) notebookId: number,
    @Req() req: ReqAuth,
    @Body() dados: CriarAvaliacaoDto,
  ) {
    const produtoId =
      await this.avaliacoesService.produtoIdPorNotebook(notebookId);
    return this.criarProduto(produtoId, req.usuario.id, dados);
  }
}

@ApiTags('Avaliações')
@Controller('builds/:buildId/avaliacoes')
export class BuildsAvaliacoesController extends AvaliacoesAliasBase {
  constructor(avaliacoesService: AvaliacoesService) {
    super(avaliacoesService);
  }

  @Get()
  async listar(
    @Param('buildId', ParsePositiveIntPipe) buildId: number,
    @Query() filtros: FiltrarAvaliacoesDto,
  ) {
    const produtoId = await this.avaliacoesService.produtoIdPorBuild(buildId);
    return this.listarProduto(produtoId, filtros);
  }

  @Post()
  @UseGuards(AuthGuard)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  async criar(
    @Param('buildId', ParsePositiveIntPipe) buildId: number,
    @Req() req: ReqAuth,
    @Body() dados: CriarAvaliacaoDto,
  ) {
    const produtoId = await this.avaliacoesService.produtoIdPorBuild(buildId);
    return this.criarProduto(produtoId, req.usuario.id, dados);
  }
}
