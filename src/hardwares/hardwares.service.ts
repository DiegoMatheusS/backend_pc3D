import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CriarHardwareDto } from './dtos/criar-hardware.dto';
import { AtualizarHardwareDto } from './dtos/atualizar-hardware.dto';

@Injectable()
export class HardwaresService {
  constructor(private readonly prisma: PrismaService) {}

  private criarSlug(texto: string): string {
    const slug = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || 'hardware';
  }

  private async criarSlugUnico(
    texto: string,
    ignorarId?: number,
  ): Promise<string> {
    const slugBase = this.criarSlug(texto);

    let slug = slugBase;
    let numero = 2;

    while (true) {
      const hardwareExistente = await this.prisma.hardware.findUnique({
        where: {
          slug,
        },
        select: {
          id: true,
        },
      });

      if (!hardwareExistente || hardwareExistente.id === ignorarId) {
        return slug;
      }

      slug = `${slugBase}-${numero}`;
      numero++;
    }
  }

  listarTodos() {
    return this.prisma.hardware.findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  async buscarPorIdAdmin(id: number) {
    const hardware = await this.prisma.hardware.findUnique({
      where: {
        id,
      },
    });

    if (!hardware) {
      throw new NotFoundException('Hardware não encontrado.');
    }

    return hardware;
  }

  listarPublicados() {
    return this.prisma.hardware.findMany({
      where: {
        ativo: true,
        publicado: true,
      },
      select: {
        id: true,
        nome: true,
        slug: true,
        categoria: true,
        marca: true,
        modelo: true,
        descricao: true,
        imagemUrl: true,
        especificacoes: true,
        criadoEm: true,
        atualizadoEm: true,
      },
      orderBy: {
        nome: 'asc',
      },
    });
  }

  async buscarPublicadoPorId(id: number) {
    const hardware = await this.prisma.hardware.findFirst({
      where: {
        id,
        ativo: true,
        publicado: true,
      },
      select: {
        id: true,
        nome: true,
        slug: true,
        categoria: true,
        marca: true,
        modelo: true,
        descricao: true,
        imagemUrl: true,
        especificacoes: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });

    if (!hardware) {
      throw new NotFoundException('Hardware não encontrado.');
    }

    return hardware;
  }

  async criar(dados: CriarHardwareDto) {
    const nome = dados.nome.trim();
    const marca = dados.marca.trim();
    const modelo = dados.modelo.trim();

    const slug = await this.criarSlugUnico(`${marca} ${modelo} ${nome}`);

    try {
      return await this.prisma.hardware.create({
        data: {
          nome,
          slug,
          categoria: dados.categoria,
          marca,
          modelo,
          descricao: dados.descricao?.trim(),
          imagemUrl: dados.imagemUrl?.trim(),
          especificacoes: dados.especificacoes as
            Prisma.InputJsonValue | undefined,
          publicado: dados.publicado ?? false,
          ativo: dados.ativo ?? true,
        },
      });
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um hardware com estes dados.');
      }

      throw erro;
    }
  }
  async atualizar(id: number, dados: AtualizarHardwareDto) {
    const hardwareAtual = await this.buscarPorIdAdmin(id);

    const nome = dados.nome?.trim() ?? hardwareAtual.nome;
    const marca = dados.marca?.trim() ?? hardwareAtual.marca;
    const modelo = dados.modelo?.trim() ?? hardwareAtual.modelo;

    const deveAtualizarSlug =
      dados.nome !== undefined ||
      dados.marca !== undefined ||
      dados.modelo !== undefined;

    const slug = deveAtualizarSlug
      ? await this.criarSlugUnico(`${marca} ${modelo} ${nome}`, id)
      : hardwareAtual.slug;

    try {
      return await this.prisma.hardware.update({
        where: {
          id,
        },
        data: {
          nome,
          slug,
          categoria: dados.categoria,
          marca,
          modelo,
          descricao: dados.descricao?.trim(),
          imagemUrl: dados.imagemUrl?.trim(),
          especificacoes:
            dados.especificacoes === undefined
              ? undefined
              : (dados.especificacoes as Prisma.InputJsonValue),
          publicado: dados.publicado,
          ativo: dados.ativo,
        },
      });
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um hardware com estes dados.');
      }

      throw erro;
    }
  }

  async remover(id: number) {
    await this.buscarPorIdAdmin(id);

    await this.prisma.hardware.update({
      where: {
        id,
      },
      data: {
        ativo: false,
        publicado: false,
      },
    });

    return {
      mensagem: 'Hardware removido com sucesso.',
    };
  }

  async removerPermanentemente(id: number) {
    await this.buscarPorIdAdmin(id);

    try {
      await this.prisma.hardware.delete({
        where: {
          id,
        },
      });

      return {
        mensagem: 'Hardware excluído permanentemente.',
      };
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2003'
      ) {
        throw new ConflictException(
          'Este hardware possui vínculos e não pode ser excluído permanentemente.',
        );
      }

      throw erro;
    }
  }
}
