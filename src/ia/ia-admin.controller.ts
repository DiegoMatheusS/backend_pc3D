import { IsString, MinLength, MaxLength } from 'class-validator';
import {
  BadGatewayException,
  ServiceUnavailableException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  ParseUUIDPipe,
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

class CriarChaveExtensaoDto {
  @IsString() @MinLength(2) @MaxLength(80) nome!: string;
}

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

  @Get('operacoes/resumo')
  @Papeis(PapelUsuario.ADMIN)
  async operacoesResumo() {
    const base = process.env.PRODUTO_IA_URL?.replace(/\/+$/, '');
    const key = process.env.PRODUTO_IA_API_KEY;
    if (!base || !key)
      throw new ServiceUnavailableException('ProjetoIA não configurado.');
    const response = await fetch(`${base}/admin/operacoes/resumo`, {
      headers: { 'X-API-Key': key },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new BadGatewayException(
        'Não foi possível consultar as métricas do agente.',
      );
    return response.json() as Promise<unknown>;
  }

  private async chaveExtensao(path: string, method: string, body?: object) {
    const base = process.env.PRODUTO_IA_URL?.replace(/\/+$/, '');
    const key = process.env.PRODUTO_IA_API_KEY;
    if (!base || !key)
      throw new ServiceUnavailableException('ProjetoIA não configurado.');
    const response = await fetch(`${base}/admin/extensao/chaves${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      ...(body && { body: JSON.stringify(body) }),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new BadGatewayException(
        'Não foi possível gerenciar a chave da extensão.',
      );
    return response.json() as Promise<unknown>;
  }
  @Get('extensao/chaves')
  @Papeis(PapelUsuario.ADMIN)
  listarChavesExtensao() {
    return this.chaveExtensao('', 'GET');
  }
  @Post('extensao/chaves')
  @Papeis(PapelUsuario.ADMIN)
  @Throttle({ global: { limit: 3, ttl: 60000 } })
  criarChaveExtensao(@Body() body: CriarChaveExtensaoDto) {
    return this.chaveExtensao('', 'POST', body);
  }
  @Post('extensao/chaves/:id/revogar')
  @Papeis(PapelUsuario.ADMIN)
  revogarChaveExtensao(@Param('id', ParseUUIDPipe) id: string) {
    return this.chaveExtensao(`/${id}/revogar`, 'POST');
  }

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
   * página e preservamos a descrição do vendedor na prévia da Produto IA.
   */
  private async complementarDetalhesShopee(
    url: string,
    resultado: unknown,
  ): Promise<unknown> {
    if (!this.ehShopee(url) || !ehRegistro(resultado)) return resultado;
    const produtoIa = resultado.resultadoProdutoIa;
    if (
      ehRegistro(produtoIa) &&
      ehRegistro(produtoIa.politicaColeta) &&
      produtoIa.politicaColeta.scrapingComplementarExecutado === true
    ) {
      return resultado;
    }

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
      if (!ehRegistro(bruto) || !ehRegistro(bruto.detalhesPagina))
        return resultado;
      const detalhes = bruto.detalhesPagina;
      if (detalhes.ok !== true) return resultado;

      const descricao = texto(detalhes.descricao);
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
      if (descricao) {
        camposCompletos.descricao = descricao;
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
        descricaoAnuncio: descricao || undefined,
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
