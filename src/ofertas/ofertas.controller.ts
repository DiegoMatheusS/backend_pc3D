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
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { PapelGuard } from '../auth/papel.guard';
import { Papeis } from '../auth/papeis.decorator';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { PapelUsuario, AcaoAuditoria } from '../generated/prisma/enums';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { OfertasService } from './ofertas.service';
import { SugestoesOfertasService } from '../sugestoes-ofertas/sugestoes-ofertas.service';
import { CriarParceiroDto } from './dtos/criar-parceiro.dto';
import { AtualizarParceiroDto } from './dtos/atualizar-parceiro.dto';
import { CriarOfertaDto } from './dtos/criar-oferta.dto';
import { AtualizarOfertaDto } from './dtos/atualizar-oferta.dto';
import { VerificarPrecosOfertasDto } from './dtos/verificar-precos-ofertas.dto';

type UsuarioReq = { id: number; papel: string } | null;

// ── Rotas públicas ────────────────────────────────────────────────────────────

@ApiTags('Ofertas')
@Controller('ofertas')
export class OfertasController {
  constructor(private readonly ofertasService: OfertasService) {}

  @Get('parceiros')
  listarParceiros() {
    return this.ofertasService.listarParceirosPublicos();
  }

  @Get('destaques')
  listarDestaques() {
    return this.ofertasService.listarDestaques();
  }

  @Get('produto/:produtoId')
  listarOfertasDoProduto(
    @Param('produtoId', ParsePositiveIntPipe) produtoId: number,
  ) {
    return this.ofertasService.listarOfertasDoProduto(produtoId);
  }

  @Get('hardware/:hardwareId')
  listarOfertasDoHardware(
    @Param('hardwareId', ParsePositiveIntPipe) hardwareId: number,
  ) {
    return this.ofertasService.listarOfertasDoHardware(hardwareId);
  }

  @Get(':id/historico')
  historicoOferta(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.ofertasService.historicoOferta(id, true);
  }
}

// ── Verificação de preços ─────────────────────────────────────────────────────

// Controller estático separado para garantir prioridade sobre qualquer rota
// dinâmica /admin/ofertas/:id presente agora ou adicionada futuramente.
@ApiTags('Ofertas')
@Controller('admin/ofertas/verificar-precos')
@UseGuards(AuthGuard, PapelGuard)
export class OfertasVerificacaoPrecosController {
  constructor(private readonly ofertasService: OfertasService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 2, ttl: 60_000 } })
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  verificarPrecos(@Body() dados: VerificarPrecosOfertasDto) {
    return this.ofertasService.verificarPrecosOfertas(dados.limite);
  }
}

// ── Rotas administrativas ────────────────────────────────────────────────────

@ApiTags('Ofertas')
@Controller('admin/ofertas')
@UseGuards(AuthGuard, PapelGuard)
export class OfertasAdminController {
  constructor(
    private readonly ofertasService: OfertasService,
    private readonly auditoriaService: AuditoriaService,
    private readonly sugestoesOfertasService: SugestoesOfertasService,
  ) {}

  @Post(':id/verificar-preco')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  verificarPreco(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.ofertasService.verificarPrecoOferta(id);
  }

  // ── Listar — ADMIN, EDITOR, REVISOR ──────────────────────────────────────

  @Get()
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listarOfertas() {
    return this.ofertasService.listarOfertas();
  }

  @Get('parceiros')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listarParceirosAdmin() {
    return this.ofertasService.listarParceiros();
  }

  // ── Parceiros — ADMIN e EDITOR ────────────────────────────────────────────

  @Post('parceiros')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async criarParceiro(
    @Body() dados: CriarParceiroDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.ofertasService.criarParceiro(dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.PARCEIRO_CRIADO,
      entidade: 'Parceiro',
      entidadeId: resultado.id,
      dadosNovos: { nome: dados.nome },
      ip: req.ip,
    });
    return resultado;
  }

  @Get('parceiros/:id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  buscarParceiro(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.ofertasService.buscarParceiro(id);
  }

  // Esta rota precisa ficar neste controller e antes de @Get(':id').
  // Caso contrário, o Express/Nest interpreta "sugestoes" como o :id da Oferta.
  @Get('sugestoes')
  @Papeis(PapelUsuario.ADMIN)
  listarSugestoes(
    @Query('status') status?: string,
    @Query('categoria') categoria?: string,
    @Query('busca') busca?: string,
  ) {
    return this.sugestoesOfertasService.listarAdmin({
      status,
      categoria,
      busca,
    });
  }

  @Get(':id/historico')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  historicoOferta(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.ofertasService.historicoOferta(id, false);
  }

  @Get('verificacao-precos/status')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  statusVerificacaoPrecos() {
    return this.ofertasService.statusVerificacaoPrecos();
  }

  @Get(':id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  buscarOferta(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.ofertasService.buscarOferta(id);
  }

  @Patch('parceiros/:id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async atualizarParceiro(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: AtualizarParceiroDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.ofertasService.atualizarParceiro(id, dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.PARCEIRO_ATUALIZADO,
      entidade: 'Parceiro',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }

  @Delete('parceiros/:id')
  @UseGuards(AdminGuard)
  async removerParceiro(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.ofertasService.removerParceiro(id);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.PARCEIRO_ATUALIZADO,
      entidade: 'Parceiro',
      entidadeId: id,
      dadosNovos: { removido: true },
      ip: req.ip,
    });
    return resultado;
  }

  // ── Ofertas — ADMIN e EDITOR ──────────────────────────────────────────────

  @Post()
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async criarOferta(
    @Body() dados: CriarOfertaDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.ofertasService.criarOferta(dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.OFERTA_CRIADA,
      entidade: 'Oferta',
      entidadeId: resultado.id,
      dadosNovos: {
        produtoId: dados.produtoId,
        hardwareId: dados.hardwareId,
        parceiroId: dados.parceiroId,
        vendedorIdentificador: dados.vendedorIdentificador,
      },
      ip: req.ip,
    });
    return resultado;
  }

  @Patch(':id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async atualizarOferta(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: AtualizarOfertaDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.ofertasService.atualizarOferta(id, dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.OFERTA_ATUALIZADA,
      entidade: 'Oferta',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  async removerOferta(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.ofertasService.removerOferta(id);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.OFERTA_REMOVIDA,
      entidade: 'Oferta',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }
}
