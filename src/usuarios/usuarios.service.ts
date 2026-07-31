import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlterarMinhaSenhaDto } from './dtos/alterar-minha-senha.dto';
import { AtualizarMeuPerfilDto } from './dtos/atualizar-meu-perfil.dto';
import { AtualizarUsuarioDto } from './dtos/atualizar-usuario.dto';
import { CriarUsuarioDto } from './dtos/criar-usuario.dto';
import { RedefinirSenhaUsuarioDto } from './dtos/redefinir-senha-usuario.dto';
import { PapelUsuario } from '../generated/prisma/enums';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.usuario.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async buscarPorId(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return usuario;
  }

  async criar(dados: CriarUsuarioDto) {
    const nome = dados.nome.trim();
    const email = dados.email.trim().toLowerCase();

    const senhaHash = await argon2.hash(dados.senha, {
      type: argon2.argon2id,
    });

    try {
      return await this.prisma.usuario.create({
        data: {
          nome,
          email,
          senhaHash,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          papel: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      });
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um usuário com este e-mail.');
      }

      throw erro;
    }
  }

  async atualizar(
    id: number,
    dados: AtualizarUsuarioDto,
    administradorId: number,
  ) {
    const usuarioAtual = await this.buscarPorId(id);

    const alterandoPropriaConta = id === administradorId;

    const desativandoConta = dados.ativo === false;

    const removendoPapelAdmin =
      dados.papel !== undefined && dados.papel !== PapelUsuario.ADMIN;

    if (alterandoPropriaConta && desativandoConta) {
      throw new BadRequestException(
        'Você não pode desativar sua própria conta.',
      );
    }

    if (alterandoPropriaConta && removendoPapelAdmin) {
      throw new BadRequestException(
        'Você não pode remover seu próprio acesso de administrador.',
      );
    }

    const removendoUltimoAdminAtivo =
      usuarioAtual.papel === PapelUsuario.ADMIN &&
      usuarioAtual.ativo &&
      (desativandoConta || removendoPapelAdmin);

    if (removendoUltimoAdminAtivo) {
      const quantidadeAdminsAtivos = await this.prisma.usuario.count({
        where: {
          papel: PapelUsuario.ADMIN,
          ativo: true,
        },
      });

      if (quantidadeAdminsAtivos <= 1) {
        throw new BadRequestException(
          'O sistema precisa manter pelo menos um administrador ativo.',
        );
      }
    }

    try {
      const usuarioAtualizado = await this.prisma.$transaction(
        async (transacao) => {
          const usuario = await transacao.usuario.update({
            where: {
              id,
            },
            data: {
              nome: dados.nome?.trim(),
              email: dados.email?.trim().toLowerCase(),
              papel: dados.papel,
              ativo: dados.ativo,
            },
            select: {
              id: true,
              nome: true,
              email: true,
              papel: true,
              ativo: true,
              criadoEm: true,
              atualizadoEm: true,
            },
          });

          if (dados.ativo === false) {
            await transacao.sessao.updateMany({
              where: {
                usuarioId: id,
                revogadaEm: null,
              },
              data: {
                revogadaEm: new Date(),
              },
            });
          }

          return usuario;
        },
      );

      return usuarioAtualizado;
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um usuário com este e-mail.');
      }

      throw erro;
    }
  }

  async atualizarMeuPerfil(id: number, dados: AtualizarMeuPerfilDto) {
    await this.buscarPorId(id);

    try {
      return await this.prisma.usuario.update({
        where: {
          id,
        },
        data: {
          nome: dados.nome?.trim(),
          email: dados.email?.trim().toLowerCase(),
        },
        select: {
          id: true,
          nome: true,
          email: true,
          papel: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      });
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um usuário com este e-mail.');
      }

      throw erro;
    }
  }

  async alterarMinhaSenha(id: number, dados: AlterarMinhaSenhaDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: {
        id,
      },
      select: {
        senhaHash: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const senhaAtualCorreta = await argon2.verify(
      usuario.senhaHash,
      dados.senhaAtual,
    );

    if (!senhaAtualCorreta) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const novaSenhaHash = await argon2.hash(dados.novaSenha, {
      type: argon2.argon2id,
    });

    const agora = new Date();

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: {
          id,
        },
        data: {
          senhaHash: novaSenhaHash,
        },
      }),
      this.prisma.sessao.updateMany({
        where: {
          usuarioId: id,
          revogadaEm: null,
        },
        data: {
          revogadaEm: agora,
        },
      }),
    ]);

    return {
      mensagem: 'Senha alterada com sucesso. Faça login novamente.',
    };
  }
  async redefinirSenha(id: number, dados: RedefinirSenhaUsuarioDto) {
    await this.buscarPorId(id);

    const senhaHash = await argon2.hash(dados.novaSenha, {
      type: argon2.argon2id,
    });

    const agora = new Date();

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: {
          id,
        },
        data: {
          senhaHash,
        },
      }),
      this.prisma.sessao.updateMany({
        where: {
          usuarioId: id,
          revogadaEm: null,
        },
        data: {
          revogadaEm: agora,
        },
      }),
    ]);

    return {
      mensagem:
        'Senha redefinida com sucesso. As sessões do usuário foram encerradas.',
    };
  }
}
