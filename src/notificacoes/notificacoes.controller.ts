import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { NotificacoesService } from './notificacoes.service';

type UsuarioReq = { id: number; papel: string } | null;

@ApiTags('Notificações')
@Controller('notificacoes')
@UseGuards(AuthGuard)
export class NotificacoesController {
  constructor(private readonly notificacoesService: NotificacoesService) {}

  private usuarioId(usuario: UsuarioReq): number {
    if (!usuario) throw new UnauthorizedException('Sessão não encontrada.');
    return usuario.id;
  }

  @Get()
  listar(
    @UsuarioAtual() usuario: UsuarioReq,
    @Query('limite') limite?: string,
  ) {
    const numero = limite ? Number(limite) : undefined;
    return this.notificacoesService.listar(
      this.usuarioId(usuario),
      Number.isInteger(numero) ? numero : undefined,
    );
  }

  @Get('resumo')
  resumo(@UsuarioAtual() usuario: UsuarioReq) {
    return this.notificacoesService.resumo(this.usuarioId(usuario));
  }

  @Patch('ler-todas')
  marcarTodas(@UsuarioAtual() usuario: UsuarioReq) {
    return this.notificacoesService.marcarTodasComoLidas(
      this.usuarioId(usuario),
    );
  }

  @Patch(':id/lida')
  marcarLida(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioReq,
  ) {
    return this.notificacoesService.marcarComoLida(this.usuarioId(usuario), id);
  }
}
