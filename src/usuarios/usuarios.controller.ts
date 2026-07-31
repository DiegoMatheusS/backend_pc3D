import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
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

@Controller('usuarios')
@UseGuards(AuthGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @UseGuards(AdminGuard)
  listar() {
    return this.usuariosService.listar();
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
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

  @Patch('me/senha')
  alterarMinhaSenha(
    @Req() requisicao: RequisicaoAutenticada,
    @Body() dados: AlterarMinhaSenhaDto,
  ) {
    return this.usuariosService.alterarMinhaSenha(requisicao.usuario.id, dados);
  }

  @Patch(':id/senha')
  @UseGuards(AdminGuard)
  redefinirSenha(
    @Param('id', ParseIntPipe) id: number,
    @Body() dados: RedefinirSenhaUsuarioDto,
  ) {
    return this.usuariosService.redefinirSenha(id, dados);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  atualizar(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id', ParseIntPipe) id: number,
    @Body() dados: AtualizarUsuarioDto,
  ) {
    return this.usuariosService.atualizar(id, dados, requisicao.usuario.id);
  }

  @Post()
  @UseGuards(AdminGuard)
  criar(@Body() dados: CriarUsuarioDto) {
    return this.usuariosService.criar(dados);
  }
}
