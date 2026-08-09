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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { PapelGuard } from '../auth/papel.guard';
import { Papeis } from '../auth/papeis.decorator';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { PapelUsuario } from '../generated/prisma/enums';
import { AcaoAuditoria } from '../generated/prisma/enums';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AtualizarHardwareDto } from './dtos/atualizar-hardware.dto';
import { ImportarProdutoDto } from './dtos/importar-produto.dto';
import { HardwaresService } from './hardwares.service';
import { CriarCompatibilidadeCpuPlacaMaeDto } from './dtos/criar-compatibilidade-cpu-placa-mae.dto';
import { CriarCompatibilidadeMemoriaPlacaMaeDto } from './dtos/criar-compatibilidade-memoria-placa-mae.dto';
import { CriarModelo3DHardwareDto } from './dtos/modelos-3d/criar-modelo-3d-hardware.dto';
import { AtualizarStatusModelo3DDto } from './dtos/modelos-3d/atualizar-status-modelo-3d.dto';
import { AtualizarModelo3DHardwareDto } from './dtos/modelos-3d/atualizar-modelo-3d-hardware.dto';
import { CriarPontoEncaixeHardwareDto } from './dtos/modelos-3d/criar-ponto-encaixe-hardware.dto';
import { CriarAjusteEncaixeHardwareDto } from './dtos/modelos-3d/criar-ajuste-encaixe-hardware.dto';
import { AtualizarPontoEncaixeHardwareDto } from './dtos/modelos-3d/atualizar-ponto-encaixe-hardware.dto';
import { AtualizarAjusteEncaixeHardwareDto } from './dtos/modelos-3d/atualizar-ajuste-encaixe-hardware.dto';

type UsuarioReq = { id: number; papel: string } | null;

// Guard base: autenticado + verifica papel via @Papeis
// O controller exige autenticação; cada rota define quais papéis têm acesso.
@ApiTags('Hardwares Admin')
@Controller('admin/hardwares')
@UseGuards(AuthGuard, PapelGuard)
export class HardwaresAdminController {
  constructor(
    private readonly hardwaresService: HardwaresService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // ── Leitura — ADMIN, EDITOR, REVISOR ─────────────────────────────────────

  @Get()
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listarTodos() {
    return this.hardwaresService.listarTodos();
  }

  @Get(':id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  buscarPorId(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.hardwaresService.buscarPorIdAdmin(id);
  }

  @Get(':hardwarePaiId/pontos-encaixe')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listarPontosEncaixeHardwareAdmin(
    @Param('hardwarePaiId', ParsePositiveIntPipe) hardwarePaiId: number,
  ) {
    return this.hardwaresService.listarPontosEncaixeHardwareAdmin(
      hardwarePaiId,
    );
  }

  @Get(':hardwareId/modelos-3d')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listarModelos3DHardwareAdmin(
    @Param('hardwareId', ParsePositiveIntPipe) hardwareId: number,
  ) {
    return this.hardwaresService.listarModelos3DHardwareAdmin(hardwareId);
  }

  @Get('compatibilidades/cpu-placa-mae')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listarCompatibilidadesCpuPlacaMae() {
    return this.hardwaresService.listarCompatibilidadesCpuPlacaMae();
  }

  @Get('compatibilidades/memoria-placa-mae')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listarCompatibilidadesMemoriaPlacaMae() {
    return this.hardwaresService.listarCompatibilidadesMemoriaPlacaMae();
  }

  @Get('compatibilidades/memoria-placa-mae/:placaMaeId/:memoriaRamId')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  verificarCompatibilidadeMemoriaPlacaMae(
    @Param('placaMaeId', ParsePositiveIntPipe) placaMaeId: number,
    @Param('memoriaRamId', ParsePositiveIntPipe) memoriaRamId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadeMemoriaPlacaMae(
      placaMaeId,
      memoriaRamId,
    );
  }

  // ── Importação por URL — ADMIN e EDITOR ──────────────────────────────────

  @Post('importar')
  @HttpCode(HttpStatus.OK)
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  importarProduto(@Body() dados: ImportarProdutoDto) {
    return this.hardwaresService.importarProdutoPorUrl(dados.urlOriginal);
  }

  // ── Criação/edição — ADMIN e EDITOR ──────────────────────────────────────

  @Patch(':id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async atualizar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: AtualizarHardwareDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.hardwaresService.atualizar(id, dados);

    const acaoPublicacao =
      dados.publicado === true
        ? AcaoAuditoria.HARDWARE_PUBLICADO
        : dados.publicado === false
          ? AcaoAuditoria.HARDWARE_DESPUBLICADO
          : null;

    if (acaoPublicacao) {
      void this.auditoriaService.registrar({
        usuarioId: usuario?.id,
        acao: acaoPublicacao,
        entidade: 'Hardware',
        entidadeId: id,
        dadosNovos: { publicado: dados.publicado },
        ip: req.ip,
      });
    }

    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.HARDWARE_ATUALIZADO,
      entidade: 'Hardware',
      entidadeId: id,
      ip: req.ip,
    });

    return resultado;
  }

  @Post(':hardwareId/modelos-3d')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async criarModelo3DHardware(
    @Param('hardwareId', ParsePositiveIntPipe) hardwareId: number,
    @Body() dados: CriarModelo3DHardwareDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.hardwaresService.criarModelo3DHardware(
      hardwareId,
      dados,
    );
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.MODELO_3D_CRIADO,
      entidade: 'Modelo3DHardware',
      entidadeId: resultado.id,
      dadosNovos: { hardwareId },
      ip: req.ip,
    });
    return resultado;
  }

  @Patch('modelos-3d/:modeloId')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  atualizarModelo3DHardware(
    @Param('modeloId', ParsePositiveIntPipe) modeloId: number,
    @Body() dados: AtualizarModelo3DHardwareDto,
  ) {
    return this.hardwaresService.atualizarModelo3DHardware(modeloId, dados);
  }

  @Post(':hardwarePaiId/pontos-encaixe')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  criarPontoEncaixeHardware(
    @Param('hardwarePaiId', ParsePositiveIntPipe) hardwarePaiId: number,
    @Body() dados: CriarPontoEncaixeHardwareDto,
  ) {
    return this.hardwaresService.criarPontoEncaixeHardware(
      hardwarePaiId,
      dados,
    );
  }

  @Patch('pontos-encaixe/:pontoEncaixeId')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  atualizarPontoEncaixeHardware(
    @Param('pontoEncaixeId', ParsePositiveIntPipe) pontoEncaixeId: number,
    @Body() dados: AtualizarPontoEncaixeHardwareDto,
  ) {
    return this.hardwaresService.atualizarPontoEncaixeHardware(
      pontoEncaixeId,
      dados,
    );
  }

  @Post('pontos-encaixe/:pontoEncaixeId/ajustes')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  criarAjusteEncaixeHardware(
    @Param('pontoEncaixeId', ParsePositiveIntPipe) pontoEncaixeId: number,
    @Body() dados: CriarAjusteEncaixeHardwareDto,
  ) {
    return this.hardwaresService.criarAjusteEncaixeHardware(
      pontoEncaixeId,
      dados,
    );
  }

  @Patch('ajustes-encaixe/:ajusteId')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  atualizarAjusteEncaixeHardware(
    @Param('ajusteId', ParsePositiveIntPipe) ajusteId: number,
    @Body() dados: AtualizarAjusteEncaixeHardwareDto,
  ) {
    return this.hardwaresService.atualizarAjusteEncaixeHardware(
      ajusteId,
      dados,
    );
  }

  @Post('compatibilidades/cpu-placa-mae')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async criarCompatibilidadeCpuPlacaMae(
    @Body() dados: CriarCompatibilidadeCpuPlacaMaeDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado =
      await this.hardwaresService.criarCompatibilidadeCpuPlacaMae(dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.COMPATIBILIDADE_CRIADA,
      entidade: 'CompatibilidadeCpuPlacaMae',
      dadosNovos: {
        placaMaeId: dados.placaMaeId,
        processadorId: dados.processadorId,
      },
      ip: req.ip,
    });
    return resultado;
  }

  @Post('compatibilidades/memoria-placa-mae')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async criarCompatibilidadeMemoriaPlacaMae(
    @Body() dados: CriarCompatibilidadeMemoriaPlacaMaeDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado =
      await this.hardwaresService.criarCompatibilidadeMemoriaPlacaMae(dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.COMPATIBILIDADE_CRIADA,
      entidade: 'CompatibilidadeMemoriaPlacaMae',
      dadosNovos: {
        placaMaeId: dados.placaMaeId,
        memoriaRamId: dados.memoriaRamId,
      },
      ip: req.ip,
    });
    return resultado;
  }

  // ── Aprovação — ADMIN e REVISOR ───────────────────────────────────────────

  @Patch('modelos-3d/:modeloId/aprovar')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.REVISOR)
  async aprovarModelo3DHardware(
    @Param('modeloId', ParsePositiveIntPipe) modeloId: number,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado =
      await this.hardwaresService.aprovarModelo3DHardware(modeloId);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.MODELO_3D_APROVADO,
      entidade: 'Modelo3DHardware',
      entidadeId: modeloId,
      ip: req.ip,
    });
    return resultado;
  }

  @Patch('modelos-3d/:modeloId/status')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.REVISOR)
  async atualizarStatusModelo3DHardware(
    @Param('modeloId', ParsePositiveIntPipe) modeloId: number,
    @Body() dados: AtualizarStatusModelo3DDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado =
      await this.hardwaresService.atualizarStatusModelo3DHardware(
        modeloId,
        dados,
      );
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao:
        dados.ativo === false
          ? AcaoAuditoria.MODELO_3D_DESATIVADO
          : AcaoAuditoria.MODELO_3D_APROVADO,
      entidade: 'Modelo3DHardware',
      entidadeId: modeloId,
      dadosNovos: { ativo: dados.ativo },
      ip: req.ip,
    });
    return resultado;
  }

  // ── Exclusão — somente ADMIN ──────────────────────────────────────────────

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remover(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.hardwaresService.remover(id);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.HARDWARE_REMOVIDO,
      entidade: 'Hardware',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }

  @Delete(':id/permanente')
  @UseGuards(AdminGuard)
  async removerPermanentemente(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.hardwaresService.removerPermanentemente(id);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.HARDWARE_REMOVIDO_PERMANENTEMENTE,
      entidade: 'Hardware',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }
}
