import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuardOpcional } from '../auth/auth-guard-opcional.guard';
import { AuthGuard } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ComunidadeService } from './comunidade.service';
import type { UsuarioComunidade } from './comunidade.service';
import { AtualizarBuildComunidadeDto } from './dtos/atualizar-build-comunidade.dto';
import { AvaliarBuildComunidadeDto } from './dtos/avaliar-build-comunidade.dto';
import { CriarBuildComunidadeDto } from './dtos/criar-build-comunidade.dto';
import { CriarComentarioBuildDto } from './dtos/criar-comentario-build.dto';
import { FiltrarBuildsComunidadeDto } from './dtos/filtrar-builds-comunidade.dto';

@ApiTags('Comunidade')
@Controller('comunidade/builds')
export class ComunidadeController {
  constructor(private readonly comunidadeService: ComunidadeService) {}

  private exigirUsuario(usuario: UsuarioComunidade) {
    if (!usuario) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }
    return usuario;
  }

  @Get()
  listar(@Query() filtros: FiltrarBuildsComunidadeDto) {
    return this.comunidadeService.listarPublicas(filtros);
  }

  @Get('minhas')
  @UseGuards(AuthGuard)
  listarMinhas(@UsuarioAtual() usuario: UsuarioComunidade) {
    const autenticado = this.exigirUsuario(usuario);
    return this.comunidadeService.listarMinhas(autenticado.id);
  }

  @Post()
  @UseGuards(AuthGuard)
  criar(
    @UsuarioAtual() usuario: UsuarioComunidade,
    @Body() dados: CriarBuildComunidadeDto,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    return this.comunidadeService.criar(autenticado.id, dados);
  }

  @Post(':id/copiar')
  @UseGuards(AuthGuard)
  copiar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    return this.comunidadeService.copiar(id, autenticado.id, autenticado);
  }

  @Post(':id/avaliacao')
  @UseGuards(AuthGuard)
  avaliar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
    @Body() dados: AvaliarBuildComunidadeDto,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    return this.comunidadeService.avaliar(
      id,
      autenticado.id,
      autenticado,
      dados,
    );
  }

  @Get(':id/comentarios')
  @UseGuards(AuthGuardOpcional)
  listarComentarios(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
  ) {
    return this.comunidadeService.listarComentarios(id, usuario);
  }

  @Post(':id/comentarios')
  @UseGuards(AuthGuard)
  criarComentario(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
    @Body() dados: CriarComentarioBuildDto,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    return this.comunidadeService.criarComentario(
      id,
      autenticado.id,
      autenticado,
      dados,
    );
  }

  @Get(':id')
  @UseGuards(AuthGuardOpcional)
  buscar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
  ) {
    return this.comunidadeService.buscar(id, usuario);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
    @Body() dados: AtualizarBuildComunidadeDto,
  ) {
    return this.comunidadeService.atualizar(id, usuario, dados);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remover(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
  ) {
    return this.comunidadeService.remover(id, usuario);
  }
}
