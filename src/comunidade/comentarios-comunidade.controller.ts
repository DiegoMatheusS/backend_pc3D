import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ComunidadeService } from './comunidade.service';
import type { UsuarioComunidade } from './comunidade.service';
import { AtualizarComentarioBuildDto } from './dtos/atualizar-comentario-build.dto';

@ApiTags('Comunidade')
@Controller('comunidade/comentarios')
@UseGuards(AuthGuard)
export class ComentariosComunidadeController {
  constructor(private readonly comunidadeService: ComunidadeService) {}

  private exigirUsuario(usuario: UsuarioComunidade) {
    if (!usuario) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }
    return usuario;
  }

  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
    @Body() dados: AtualizarComentarioBuildDto,
  ) {
    return this.comunidadeService.atualizarComentario(
      id,
      this.exigirUsuario(usuario),
      dados,
    );
  }

  @Delete(':id')
  remover(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
  ) {
    return this.comunidadeService.removerComentario(
      id,
      this.exigirUsuario(usuario),
    );
  }
}
