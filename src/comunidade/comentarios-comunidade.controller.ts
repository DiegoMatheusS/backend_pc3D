import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ComunidadeNotificacoesService } from './comunidade-notificacoes.service';
import { ComunidadeService } from './comunidade.service';
import type { UsuarioComunidade } from './comunidade.service';
import { AtualizarComentarioBuildDto } from './dtos/atualizar-comentario-build.dto';

@ApiTags('Comunidade')
@Controller('comunidade/comentarios')
@UseGuards(AuthGuard)
export class ComentariosComunidadeController {
  constructor(
    private readonly comunidadeService: ComunidadeService,
    private readonly comunidadeNotificacoes: ComunidadeNotificacoesService,
  ) {}

  private exigirUsuario(usuario: UsuarioComunidade) {
    if (!usuario) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }
    return usuario;
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
    @Body() dados: AtualizarComentarioBuildDto,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    const resultado = await this.comunidadeService.atualizarComentario(
      id,
      autenticado,
      dados,
    );
    await this.comunidadeNotificacoes.comentarioModeradoPorAdmin(
      id,
      autenticado,
      'ALTERADO',
    );
    return resultado;
  }

  @Delete(':id')
  async remover(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    const resultado = await this.comunidadeService.removerComentario(
      id,
      autenticado,
    );
    await this.comunidadeNotificacoes.comentarioModeradoPorAdmin(
      id,
      autenticado,
      'REMOVIDO',
    );
    return resultado;
  }
}
