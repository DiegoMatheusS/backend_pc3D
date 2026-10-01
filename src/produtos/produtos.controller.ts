import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { ParseSlugPipe } from '../common/pipes/parse-slug.pipe';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Prisma } from '../generated/prisma/client';
import {
  AcaoAuditoria,
  PapelUsuario,
  TipoProduto,
} from '../generated/prisma/enums';
import { AuthGuard } from '../auth/auth.guard';
import { PapelGuard } from '../auth/papel.guard';
import { Papeis } from '../auth/papeis.decorator';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarCategoriaProdutoDto } from './dtos/atualizar-categoria-produto.dto';
import { AtualizarProdutoDto } from './dtos/atualizar-produto.dto';
import { CriarCategoriaProdutoDto } from './dtos/criar-categoria-produto.dto';
import { CriarProdutoDto } from './dtos/criar-produto.dto';
import { CriarProdutoDeHardwareDto } from './dtos/criar-produto-de-hardware.dto';
import { FiltrarHardwaresDisponiveisDto } from './dtos/filtrar-hardwares-disponiveis.dto';
import { FiltrarProdutosDto } from './dtos/filtrar-produtos.dto';
import { ImportarProdutoLojaDto } from './dtos/importar-produto-loja.dto';
import { RevisarImportacaoProdutoDto } from './dtos/revisar-importacao-produto.dto';
import { ProdutosService } from './produtos.service';

type UsuarioReq = { id: number; papel: string } | null;

@ApiTags('Loja')
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Get()
  listar(@Query() filtros: FiltrarProdutosDto) {
    return this.produtosService.listarPublicos(filtros);
  }

  @Get('slug/:slug')
  buscarPorSlug(@Param('slug', ParseSlugPipe) slug: string) {
    return this.produtosService.buscarPublicoPorSlug(slug);
  }

  @Get(':id')
  buscarPorId(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.produtosService.buscarPublicoPorId(id);
  }
}

@ApiTags('Loja')
@Controller('categorias-produto')
export class CategoriasProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Get()
  listar() {
    return this.produtosService.listarCategoriasPublicas();
  }
}

@ApiTags('Loja Admin')
@Controller('admin/produtos')
@UseGuards(AuthGuard, PapelGuard)
export class ProdutosAdminController {
  constructor(
    private readonly produtosService: ProdutosService,
    private readonly auditoriaService: AuditoriaService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listar() {
    return this.produtosService.listarAdmin();
  }

  @Get('importacoes')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listarImportacoes() {
    return this.produtosService.listarImportacoes();
  }

  @Post('importar')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 5, ttl: 60_000 } })
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async importar(
    @Body() dados: ImportarProdutoLojaDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.produtosService.importarProdutoPorUrl(
      dados.urlOriginal,
    );
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.IMPORTACAO_PRODUTO_CRIADA,
      entidade: 'ImportacaoProduto',
      entidadeId: resultado.importacaoId,
      dadosNovos: { urlOriginal: dados.urlOriginal },
      ip: req.ip,
    });
    return resultado;
  }

  @Patch('importacoes/:id/revisar')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.REVISOR)
  async revisarImportacao(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: RevisarImportacaoProdutoDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.produtosService.revisarImportacao(
      id,
      usuario?.id,
      dados,
    );
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.IMPORTACAO_PRODUTO_REVISADA,
      entidade: 'ImportacaoProduto',
      entidadeId: id,
      dadosNovos: { aprovada: dados.aprovada, produtoId: dados.produtoId },
      ip: req.ip,
    });
    return resultado;
  }

  @Post()
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async criar(
    @Body() dados: CriarProdutoDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.produtosService.criar(dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.PRODUTO_CRIADO,
      entidade: 'Produto',
      entidadeId: resultado.id,
      dadosNovos: {
        nome: dados.nome,
        categoriaId: dados.categoriaId,
        ofertaInicial: dados.ofertaInicial !== undefined,
      },
      ip: req.ip,
    });
    if (dados.ofertaInicial) {
      void this.auditoriaService.registrar({
        usuarioId: usuario?.id,
        acao: AcaoAuditoria.OFERTA_CRIADA,
        entidade: 'Oferta',
        dadosNovos: {
          produtoId: resultado.id,
          parceiroId: dados.ofertaInicial.parceiroId,
          origem: 'CADASTRO_PRODUTO',
        },
        ip: req.ip,
      });
    }
    return resultado;
  }

  @Get('hardwares/disponiveis')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listarHardwaresDisponiveis(@Query() filtros: FiltrarHardwaresDisponiveisDto) {
    return this.produtosService.listarHardwaresDisponiveis(filtros);
  }

  @Post('de-hardware/:hardwareId')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async criarDeHardware(
    @Param('hardwareId', ParsePositiveIntPipe) hardwareId: number,
    @Body() dados: CriarProdutoDeHardwareDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.produtosService.criarDeHardware(
      hardwareId,
      dados,
    );
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.PRODUTO_CRIADO,
      entidade: 'Produto',
      entidadeId: resultado.id,
      dadosNovos: {
        hardwareId,
        origem: 'HARDWARE_EXISTENTE',
        ofertaInicial: dados.ofertaInicial !== undefined,
      },
      ip: req.ip,
    });
    if (dados.ofertaInicial) {
      void this.auditoriaService.registrar({
        usuarioId: usuario?.id,
        acao: AcaoAuditoria.OFERTA_CRIADA,
        entidade: 'Oferta',
        dadosNovos: {
          produtoId: resultado.id,
          hardwareId,
          parceiroId: dados.ofertaInicial.parceiroId,
          origem: 'CADASTRO_PRODUTO_DE_HARDWARE',
        },
        ip: req.ip,
      });
    }
    return resultado;
  }

  @Get(':id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  buscar(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.produtosService.buscarAdmin(id);
  }

  @Patch(':id')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  async atualizar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: AtualizarProdutoDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.produtosService.atualizar(id, dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao:
        dados.publicado === true
          ? AcaoAuditoria.PRODUTO_PUBLICADO
          : AcaoAuditoria.PRODUTO_ATUALIZADO,
      entidade: 'Produto',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }

  @Delete(':id/permanente')
  @HttpCode(HttpStatus.OK)
  @Papeis(PapelUsuario.ADMIN)
  async excluirPermanentemente(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const produto = await this.prisma.produto.findUnique({
      where: { id },
      select: { id: true, nome: true, tipo: true, ativo: true },
    });

    if (!produto) throw new NotFoundException('Produto não encontrado.');
    if (produto.ativo) {
      throw new BadRequestException(
        'Arquive o Produto antes de excluí-lo definitivamente.',
      );
    }
    if (
      produto.tipo !== TipoProduto.GENERICO &&
      produto.tipo !== TipoProduto.HARDWARE
    ) {
      throw new BadRequestException(
        'Este Produto possui cadastro especializado de Notebook ou PC Montado e não pode ser excluído por esta rota.',
      );
    }

    try {
      await this.prisma.produto.delete({ where: { id } });
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2003'
      ) {
        throw new ConflictException(
          'O Produto possui vínculos que impedem a exclusão definitiva. Remova ou ajuste esses vínculos antes de tentar novamente.',
        );
      }
      throw erro;
    }

    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.PRODUTO_REMOVIDO,
      entidade: 'Produto',
      entidadeId: id,
      dadosNovos: { remocaoPermanente: true, nome: produto.nome },
      ip: req.ip,
    });

    return { mensagem: 'Produto excluído definitivamente.' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Papeis(PapelUsuario.ADMIN)
  async arquivar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.produtosService.arquivar(id);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.PRODUTO_REMOVIDO,
      entidade: 'Produto',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }
}

@ApiTags('Loja Admin')
@Controller('admin/categorias-produto')
@UseGuards(AuthGuard, PapelGuard)
export class CategoriasProdutosAdminController {
  constructor(
    private readonly produtosService: ProdutosService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR, PapelUsuario.REVISOR)
  listar() {
    return this.produtosService.listarCategoriasAdmin();
  }

  @Post()
  @Papeis(PapelUsuario.ADMIN)
  async criar(
    @Body() dados: CriarCategoriaProdutoDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.produtosService.criarCategoria(dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.CATEGORIA_PRODUTO_CRIADA,
      entidade: 'CategoriaProduto',
      entidadeId: resultado.id,
      ip: req.ip,
    });
    return resultado;
  }

  @Patch(':id')
  @Papeis(PapelUsuario.ADMIN)
  async atualizar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: AtualizarCategoriaProdutoDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.produtosService.atualizarCategoria(id, dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.CATEGORIA_PRODUTO_ATUALIZADA,
      entidade: 'CategoriaProduto',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }
}
