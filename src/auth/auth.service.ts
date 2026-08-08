import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PapelUsuario } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CadastroDto } from './dtos/cadastro.dto';
import { LoginDto } from './dtos/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private gerarHashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async cadastrar(dados: CadastroDto) {
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
          // Regra de segurança: cadastro público nunca escolhe papel.
          papel: PapelUsuario.USUARIO,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          papel: true,
          ativo: true,
          criadoEm: true,
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

  async login(dados: LoginDto) {
    const email = dados.email.trim().toLowerCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: {
        email,
      },
    });

    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    const senhaCorreta = await argon2.verify(usuario.senhaHash, dados.senha);

    if (!senhaCorreta) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.gerarHashToken(token);

    const duracaoHoras = Number(
      this.configService.get<string>('SESSION_DURATION_HOURS') ?? 8,
    );

    const expiraEm = new Date(Date.now() + duracaoHoras * 60 * 60 * 1000);

    await this.prisma.sessao.create({
      data: {
        usuarioId: usuario.id,
        tokenHash,
        expiraEm,
      },
    });

    return {
      token,
      expiraEm,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        ativo: usuario.ativo,
      },
    };
  }

  async validarSessao(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }

    const tokenHash = this.gerarHashToken(token);

    const sessao = await this.prisma.sessao.findUnique({
      where: {
        tokenHash,
      },
      include: {
        usuario: true,
      },
    });

    if (
      !sessao ||
      sessao.revogadaEm ||
      sessao.expiraEm <= new Date() ||
      !sessao.usuario.ativo
    ) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    return {
      id: sessao.usuario.id,
      nome: sessao.usuario.nome,
      email: sessao.usuario.email,
      papel: sessao.usuario.papel,
      ativo: sessao.usuario.ativo,
    };
  }

  async perfil(token: string | undefined) {
    return this.validarSessao(token);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    const tokenHash = this.gerarHashToken(token);

    await this.prisma.sessao.updateMany({
      where: {
        tokenHash,
        revogadaEm: null,
      },
      data: {
        revogadaEm: new Date(),
      },
    });
  }
}
