import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
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
import {
  CadastrarHardwareDescobertoDto,
  CadastrarHardwaresDescobertosLoteDto,
} from './dtos/cadastrar-hardware-descoberto.dto';
import { DescobrirHardwaresDto } from './dtos/descobrir-hardwares.dto';
import { EnriquecerMetaAiWhatsappDto } from './dtos/enriquecer-meta-ai-whatsapp.dto';
import { HardwaresDescobertaIaService } from './hardwares-descoberta-ia.service';

type UsuarioReq = { id: number; papel: PapelUsuario } | null;

@ApiTags('Hardwares - Descoberta IA')
@Controller('admin/hardwares/descobrir')
@UseGuards(AuthGuard, PapelGuard)
@Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
export class HardwaresDescobertaIaController {
  constructor(
    private readonly service: HardwaresDescobertaIaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 4, ttl: 60_000 } })
  async descobrir(
    @Body() dados: DescobrirHardwaresDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.service.descobrir(dados);

    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.IA_ADMIN_UTILIZADA,
      entidade: 'DescobertaHardwareIa',
      dadosNovos: {
        operacao: 'DESCOBRIR_HARDWARE',
        categoria: dados.categoria,
        marca: dados.marca ?? null,
        totalEncontrados: resultado.totalEncontrados,
        jaCadastrados: resultado.jaCadastrados,
        novos: resultado.novos,
        nenhumRegistroCriado: true,
      },
      ip: req.ip,
    });

    return resultado;
  }

  @Post('meta-ai-whatsapp/enriquecer')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 12, ttl: 60_000 } })
  async enriquecerMetaAiWhatsapp(
    @Body() dados: EnriquecerMetaAiWhatsappDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.service.enriquecerMetaAiWhatsapp(dados);

    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.IA_ADMIN_UTILIZADA,
      entidade: 'DescobertaHardwareIa',
      dadosNovos: {
        operacao: 'ENRIQUECER_HARDWARE_META_AI_WHATSAPP',
        categoria: dados.categoria,
        nome: dados.nome ?? dados.payload.nome ?? null,
        utilizado: resultado.utilizado ?? null,
        coberturaAntes: resultado.coberturaAntes ?? null,
        coberturaDepois: resultado.coberturaDepois ?? null,
        camposPreenchidos: Array.isArray(resultado.camposPreenchidos)
          ? resultado.camposPreenchidos
          : [],
        nenhumRegistroCriado: true,
      },
      ip: req.ip,
    });

    return resultado;
  }

  @Post('cadastrar')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  async cadastrar(
    @Body() dados: CadastrarHardwareDescobertoDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.service.cadastrar(dados);

    if (resultado.status === 'CRIADO') {
      void this.auditoriaService.registrar({
        usuarioId: usuario?.id,
        acao: AcaoAuditoria.HARDWARE_CRIADO,
        entidade: 'Hardware',
        entidadeId: resultado.hardware.id,
        dadosNovos: {
          origem: 'DESCOBERTA_IA',
          idTemporario: dados.idTemporario ?? null,
        },
        ip: req.ip,
      });
    }

    return resultado;
  }

  @Post('cadastrar-lote')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 4, ttl: 60_000 } })
  async cadastrarLote(
    @Body() dados: CadastrarHardwaresDescobertosLoteDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.service.cadastrarLote(dados.itens);

    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.IA_ADMIN_UTILIZADA,
      entidade: 'DescobertaHardwareIa',
      dadosNovos: {
        operacao: 'CADASTRAR_HARDWARE_LOTE',
        totalSolicitado: resultado.totalSolicitado,
        criados: resultado.criados,
        jaExistiam: resultado.jaExistiam,
        erros: resultado.erros,
      },
      ip: req.ip,
    });

    return resultado;
  }
}
