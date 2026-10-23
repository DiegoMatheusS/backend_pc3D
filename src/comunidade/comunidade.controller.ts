import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuardOpcional } from '../auth/auth-guard-opcional.guard';
import { AuthGuard } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ComunidadeNotificacoesService } from './comunidade-notificacoes.service';
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
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    return this.comunidadeService.copiar(id, autenticado.id, autenticado);
  }

  @Post(':id/avaliacao')
  @UseGuards(AuthGuard)
  avaliar(
    @Param('id', ParsePositiveIntPipe) id: number,
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
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
  ) {
    return this.comunidadeService.listarComentarios(id, usuario);
  }

  @Post(':id/comentarios')
  @UseGuards(AuthGuard)
  async criarComentario(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
    @Body() dados: CriarComentarioBuildDto,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    const comentario = await this.comunidadeService.criarComentario(
      id,
      autenticado.id,
      autenticado,
      dados,
    );

    await this.comunidadeNotificacoes.comentarioCriado(
      id,
      comentario.id,
      autenticado.id,
      dados.comentarioPaiId,
    );

    return comentario;
  }

  @Get(':id')
  @UseGuards(AuthGuardOpcional)
  buscar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
  ) {
    return this.comunidadeService.buscar(id, usuario);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  async atualizar(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
    @Body() dados: AtualizarBuildComunidadeDto,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    const resultado = await this.comunidadeService.atualizar(
      id,
      autenticado,
      dados,
    );
    await this.comunidadeNotificacoes.buildAlteradaPorAdmin(
      id,
      autenticado,
      'ALTERADA',
    );
    return resultado;
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remover(
    @Param('id', ParsePositiveIntPipe) id: number,
    @UsuarioAtual() usuario: UsuarioComunidade,
  ) {
    const autenticado = this.exigirUsuario(usuario);
    const resultado = await this.comunidadeService.remover(id, autenticado);
    await this.comunidadeNotificacoes.buildAlteradaPorAdmin(
      id,
      autenticado,
      'REMOVIDA',
    );
    return resultado;
  }
}
