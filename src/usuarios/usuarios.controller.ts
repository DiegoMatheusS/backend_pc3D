import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { AcaoAuditoria } from '../generated/prisma/enums';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AlterarMinhaSenhaDto } from './dtos/alterar-minha-senha.dto';
import { AtualizarMeuPerfilDto } from './dtos/atualizar-meu-perfil.dto';
import { AtualizarUsuarioDto } from './dtos/atualizar-usuario.dto';
import { CriarUsuarioDto } from './dtos/criar-usuario.dto';
import { RedefinirSenhaUsuarioDto } from './dtos/redefinir-senha-usuario.dto';
import { UsuariosService } from './usuarios.service';

type RequisicaoAutenticada = Request & {
  usuario: {
    id: number;
  };
};

type UsuarioReq = { id: number; papel: string } | null;

@ApiTags('Usuários')
@Controller('usuarios')
@UseGuards(AuthGuard)
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @UseGuards(AdminGuard)
  listar() {
    return this.usuariosService.listar();
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  buscarPorId(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.usuariosService.buscarPorId(id);
  }

  @Patch('me')
  atualizarMeuPerfil(
    @Req() requisicao: RequisicaoAutenticada,
    @Body() dados: AtualizarMeuPerfilDto,
  ) {
    return this.usuariosService.atualizarMeuPerfil(
      requisicao.usuario.id,
      dados,
    );
  }

  @Throttle({ global: { limit: 5, ttl: 60_000 } })
  @Patch('me/senha')
  alterarMinhaSenha(
    @Req() requisicao: RequisicaoAutenticada,
    @Body() dados: AlterarMinhaSenhaDto,
  ) {
    return this.usuariosService.alterarMinhaSenha(requisicao.usuario.id, dados);
  }

  @Throttle({ global: { limit: 5, ttl: 60_000 } })
  @Patch(':id/senha')
  @UseGuards(AdminGuard)
  async redefinirSenha(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: RedefinirSenhaUsuarioDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.usuariosService.redefinirSenha(id, dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.SENHA_REDEFINIDA_ADMIN,
      entidade: 'Usuario',
      entidadeId: id,
      ip: req.ip,
    });
    return resultado;
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async atualizar(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dados: AtualizarUsuarioDto,
    @UsuarioAtual() usuario: UsuarioReq,
  ) {
    const resultado = await this.usuariosService.atualizar(
      id,
      dados,
      requisicao.usuario.id,
    );
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao:
        dados.ativo === false
          ? AcaoAuditoria.USUARIO_DESATIVADO
          : AcaoAuditoria.USUARIO_ATUALIZADO,
      entidade: 'Usuario',
      entidadeId: id,
      dadosNovos:
        dados.ativo !== undefined ? { ativo: dados.ativo } : undefined,
    });
    return resultado;
  }

  @Post()
  @UseGuards(AdminGuard)
  async criar(
    @Body() dados: CriarUsuarioDto,
    @UsuarioAtual() usuario: UsuarioReq,
    @Req() req: Request,
  ) {
    const resultado = await this.usuariosService.criar(dados);
    void this.auditoriaService.registrar({
      usuarioId: usuario?.id,
      acao: AcaoAuditoria.USUARIO_CRIADO,
      entidade: 'Usuario',
      entidadeId: resultado.id,
      dadosNovos: { email: dados.email, papel: resultado.papel },
      ip: req.ip,
    });
    return resultado;
  }
}
