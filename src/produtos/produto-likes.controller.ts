import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuardOpcional } from '../auth/auth-guard-opcional.guard';
import { AuthGuard } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { ProdutoLikesService } from './produto-likes.service';

type UsuarioReq = { id: number; papel: string } | null;

@ApiTags('Loja')
@Controller('produto-likes')
export class ProdutoLikesController {
  constructor(private readonly produtoLikesService: ProdutoLikesService) {}

  private parseIds(valor?: string): number[] {
    if (!valor?.trim()) return [];

    const partes = valor.split(',').map((item) => item.trim()).filter(Boolean);
    if (partes.length > 100) {
      throw new BadRequestException(
        'Consulte no máximo 100 produtos por vez para obter os likes.',
      );
    }

    const ids = partes.map((item) => Number(item));
    if (
      ids.some(
        (id) => !Number.isInteger(id) || !Number.isSafeInteger(id) || id <= 0,
      )
    ) {
      throw new BadRequestException('A lista de produtos contém um id inválido.');
    }

    return [...new Set(ids)];
  }

  @Get('resumo')
  @UseGuards(AuthGuardOpcional)
  resumo(
    @Query('ids') ids: string | undefined,
    @UsuarioAtual() usuario: UsuarioReq,
  ) {
    return this.produtoLikesService.resumo(this.parseIds(ids), usuario?.id);
  }

  @Post(':produtoId')
  @UseGuards(AuthGuard)
  curtir(
    @Param('produtoId', ParsePositiveIntPipe) produtoId: number,
    @UsuarioAtual() usuario: UsuarioReq,
  ) {
    if (!usuario) throw new UnauthorizedException('Sessão inválida.');
    return this.produtoLikesService.curtir(produtoId, usuario.id);
  }

  @Delete(':produtoId')
  @UseGuards(AuthGuard)
  descurtir(
    @Param('produtoId', ParsePositiveIntPipe) produtoId: number,
    @UsuarioAtual() usuario: UsuarioReq,
  ) {
    if (!usuario) throw new UnauthorizedException('Sessão inválida.');
    return this.produtoLikesService.descurtir(produtoId, usuario.id);
  }
}
