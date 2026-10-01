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
import { postProdutoIa } from './produto-ia-http';
import {
  AnalisarProdutoIaDto,
  GerarDescricaoIaDto,
  NormalizarProdutoIaDto,
} from './dtos/analisar-produto-ia.dto';
import { ChatAdminIaDto } from './dtos/chat-admin-ia.dto';
import { ImportarLinkIaDto } from './dtos/importar-link-ia.dto';

type UsuarioReq = { id: number; papel: string } | null;
type Registro = Record<string, unknown>;

function ehRegistro(valor: unknown): valor is Registro {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

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

  private ehShopee(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      return host === 'shopee.com.br' || host.endsWith('.shopee.com.br');
    } catch {
      return false;
    }
  }

  /**
   * A Affiliate API da Shopee é mantida como fonte de preço/link, porém ela não
   * entrega a descrição completa. No fluxo do ADMIN buscamos os detalhes da
   * página e só preenchemos lacunas da prévia retornada pela Produto IA.
   */
  private async complementarDetalhesShopee(
    url: string,
    resultado: unknown,
  ): Promise<unknown> {
    if (!this.ehShopee(url) || !ehRegistro(resultado)) return resultado;

    const baseUrl = process.env.PRODUTO_IA_URL?.trim();
    const key = process.env.PRODUTO_IA_API_KEY?.trim();
    if (!baseUrl || !key) return resultado;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const endpoint = `${baseUrl.replace(/\/+$/, '')}/shopee/agente/produto`;
      const resposta = await postProdutoIa(endpoint, {
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({ url, detalharPagina: true }),
        signal: controller.signal,
      });
      if (!resposta.ok) return resultado;

      const bruto: unknown = await resposta.json();
      if (!ehRegistro(bruto) || !ehRegistro(bruto.detalhesPagina)) return resultado;
      const detalhes = bruto.detalhesPagina;
      if (detalhes.ok !== true) return resultado;

      const descricao = texto(detalhes.descricao);
      const atributosTexto = texto(detalhes.atributosTexto);
      const textoPagina = [descricao, atributosTexto]
        .filter(Boolean)
        .filter((valor, indice, itens) => itens.indexOf(valor) === indice)
        .join('\n\n');

      const normalizacao = ehRegistro(resultado.normalizacao)
        ? resultado.normalizacao
        : {};
      const campos = ehRegistro(normalizacao.camposNormalizados)
        ? normalizacao.camposNormalizados
        : {};
      const camposCompletos: Registro = { ...campos };

      if (!texto(camposCompletos.nome) && texto(detalhes.titulo)) {
        camposCompletos.nome = texto(detalhes.titulo);
      }
      if (!texto(camposCompletos.descricao) && textoPagina) {
        camposCompletos.descricao = textoPagina;
      }
      if (!texto(camposCompletos.imagemUrl) && texto(detalhes.imagemUrl)) {
        camposCompletos.imagemUrl = texto(detalhes.imagemUrl);
      }

      return {
        ...resultado,
        normalizacao: {
          ...normalizacao,
          camposNormalizados: camposCompletos,
        },
        detalhesPaginaShopee: detalhes,
      };
    } catch {
      // O detalhamento é complementar: se a página bloquear o datacenter ou
      // exceder o timeout, a prévia da Affiliate API continua válida.
      return resultado;
    } finally {
      clearTimeout(timer);
    }
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
    const preliminar = await this.iaService.importarLinkAdmin(normalizado);
    const resultado = await this.complementarDetalhesShopee(
      normalizado.url,
      preliminar,
    );
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
