import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
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
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { AcaoAuditoria, PapelUsuario } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { BuscarImagemProdutoDto } from './dtos/buscar-imagem-produto.dto';
import { ProdutoImagemService } from './produto-imagem.service';
import { ProdutosService } from './produtos.service';

@ApiTags('Loja Admin')
@Controller('admin/produtos')
@UseGuards(AuthGuard, PapelGuard)
@Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
@Throttle({ global: { limit: 8, ttl: 60_000 } })
export class ProdutoImagemAdminController {
  constructor(
    private readonly imagens: ProdutoImagemService,
    private readonly produtos: ProdutosService,
    private readonly auditoria: AuditoriaService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('buscar-imagem')
  @HttpCode(HttpStatus.OK)
  buscar(@Body() dados: BuscarImagemProdutoDto) {
    return this.imagens.buscar(dados);
  }

  @Post(':id/imagem')
  @HttpCode(HttpStatus.OK)
  async buscarESalvar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: { id: number } | null,
    @Req() req: Request,
  ) {
    const produto = await this.produtos.buscarAdmin(id);
    const resultado = await this.imagens.buscar(produto);
    const atualizado = await this.prisma.produto.update({
      where: { id },
      data: { imagemUrl: resultado.imagemUrl },
    });
    void this.auditoria.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.PRODUTO_ATUALIZADO,
      entidade: 'Produto',
      entidadeId: id,
      dadosNovos: {
        origem: 'BUSCA_IMAGEM_LOJAS',
        imagemUrl: resultado.imagemUrl,
        fonte: resultado.fonte,
        urlFonte: resultado.urlFonte,
      },
      ip: req.ip,
    });
    return {
      ...resultado,
      status: 'IMAGEM_ATUALIZADA' as const,
      produtoId: id,
      produto: atualizado,
    };
  }
}
