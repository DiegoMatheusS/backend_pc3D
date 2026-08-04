import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusOferta } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarOfertaDto } from './dtos/atualizar-oferta.dto';
import { AtualizarParceiroDto } from './dtos/atualizar-parceiro.dto';
import { CriarOfertaDto } from './dtos/criar-oferta.dto';
import { CriarParceiroDto } from './dtos/criar-parceiro.dto';

@Injectable()
export class OfertasService {
  constructor(private readonly prisma: PrismaService) {}

  private criarSlug(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  async criarParceiro(dados: CriarParceiroDto) {
    const slug = this.criarSlug(dados.nome);
    const existente = await this.prisma.parceiro.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existente) {
      throw new ConflictException(
        `Já existe um parceiro com o nome "${dados.nome}".`,
      );
    }
    if (dados.dominio) {
      const domExistente = await this.prisma.parceiro.findUnique({
        where: { dominio: dados.dominio },
        select: { id: true },
      });
      if (domExistente) {
        throw new ConflictException(
          `Já existe um parceiro com o domínio "${dados.dominio}".`,
        );
      }
    }
    return this.prisma.parceiro.create({
      data: {
        nome: dados.nome,
        slug,
        logoUrl: dados.logoUrl ?? null,
        site: dados.site ?? null,
        dominio: dados.dominio ?? null,
        programaAfiliados: dados.programaAfiliados ?? false,
        observacao: dados.observacao ?? null,
      },
    });
  }

  async listarParceirosPublicos() {
    const parceiros = await this.prisma.parceiro.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        slug: true,
        logoUrl: true,
        site: true,
        dominio: true,
        programaAfiliados: true,
      },
    });
    return { total: parceiros.length, parceiros };
  }

  async listarParceiros() {
    const parceiros = await this.prisma.parceiro.findMany({
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        slug: true,
        logoUrl: true,
        site: true,
        dominio: true,
        programaAfiliados: true,
        ativo: true,
        _count: { select: { ofertas: true } },
      },
    });
    return { total: parceiros.length, parceiros };
  }

  async buscarParceiro(id: number) {
    const parceiro = await this.prisma.parceiro.findUnique({
      where: { id },
      include: { _count: { select: { ofertas: true } } },
    });
    if (!parceiro) throw new NotFoundException('Parceiro não encontrado.');
    return parceiro;
  }

  async atualizarParceiro(id: number, dados: AtualizarParceiroDto) {
    const parceiro = await this.prisma.parceiro.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!parceiro) throw new NotFoundException('Parceiro não encontrado.');
    return this.prisma.parceiro.update({
      where: { id },
      data: {
        ...(dados.nome !== undefined && {
          nome: dados.nome,
          slug: this.criarSlug(dados.nome),
        }),
        ...(dados.logoUrl !== undefined && { logoUrl: dados.logoUrl }),
        ...(dados.site !== undefined && { site: dados.site }),
        ...(dados.dominio !== undefined && { dominio: dados.dominio }),
        ...(dados.programaAfiliados !== undefined && {
          programaAfiliados: dados.programaAfiliados,
        }),
        ...(dados.observacao !== undefined && { observacao: dados.observacao }),
        ...(dados.ativo !== undefined && { ativo: dados.ativo }),
      },
    });
  }

  async listarOfertas() {
    const ofertas = await this.prisma.oferta.findMany({
      orderBy: { atualizadoEm: 'desc' },
      include: {
        produto: {
          select: { id: true, nome: true, slug: true, tipo: true },
        },
        hardware: { select: { id: true, nome: true, categoria: true } },
        parceiro: { select: { id: true, nome: true, slug: true } },
      },
    });
    return { total: ofertas.length, ofertas };
  }

  async buscarOferta(id: number) {
    const oferta = await this.prisma.oferta.findUnique({
      where: { id },
      include: {
        produto: true,
        hardware: { select: { id: true, nome: true, categoria: true } },
        parceiro: true,
      },
    });
    if (!oferta) throw new NotFoundException('Oferta não encontrada.');
    return oferta;
  }

  async criarOferta(dados: CriarOfertaDto) {
    if (
      (dados.produtoId === undefined && dados.hardwareId === undefined) ||
      (dados.produtoId !== undefined && dados.hardwareId !== undefined)
    ) {
      throw new BadRequestException(
        'Informe produtoId ou hardwareId, mas não os dois ao mesmo tempo.',
      );
    }

    let produtoId = dados.produtoId;
    let hardwareId: number | null = null;
    let nomeProduto = 'Produto';

    if (dados.hardwareId !== undefined) {
      const hardware = await this.prisma.hardware.findFirst({
        where: { id: dados.hardwareId, ativo: true },
        select: { id: true, nome: true, produtoId: true },
      });
      if (!hardware || !hardware.produtoId) {
        throw new NotFoundException(
          'Hardware não encontrado, inativo ou ainda não vinculado ao catálogo.',
        );
      }
      produtoId = hardware.produtoId;
      hardwareId = hardware.id;
      nomeProduto = hardware.nome;
    } else if (produtoId !== undefined) {
      const produto = await this.prisma.produto.findFirst({
        where: { id: produtoId, ativo: true },
        include: { hardware: { select: { id: true } } },
      });
      if (!produto) {
        throw new NotFoundException('Produto não encontrado ou inativo.');
      }
      hardwareId = produto.hardware?.id ?? null;
      nomeProduto = produto.nome;
    }

    if (produtoId === undefined) {
      throw new BadRequestException('Não foi possível identificar o produto.');
    }

    const parceiro = await this.prisma.parceiro.findFirst({
      where: { id: dados.parceiroId, ativo: true },
      select: { id: true, nome: true },
    });
    if (!parceiro) {
      throw new NotFoundException('Parceiro não encontrado ou inativo.');
    }

    const existente = await this.prisma.oferta.findFirst({
      where: {
        produtoId,
        parceiroId: dados.parceiroId,
        urlOriginal: dados.urlOriginal,
      },
      select: { id: true },
    });
    if (existente) {
      throw new ConflictException(
        `Esta oferta de "${nomeProduto}" já está cadastrada no parceiro "${parceiro.nome}".`,
      );
    }

    return this.prisma.oferta.create({
      data: {
        produtoId,
        hardwareId,
        parceiroId: dados.parceiroId,
        vendedorNome: dados.vendedorNome?.trim() ?? null,
        vendedorIdentificador: dados.vendedorIdentificador?.trim() ?? null,
        urlOriginal: dados.urlOriginal,
        urlAfiliada: dados.urlAfiliada ?? null,
        preco: dados.preco,
        precoAnterior: dados.precoAnterior ?? null,
        frete: dados.frete ?? null,
        validoAte: dados.validoAte ? new Date(dados.validoAte) : null,
        verificadoEm: new Date(),
        status: StatusOferta.ATIVA,
        coletadoEm: new Date(),
        historicoPrecos: {
          create: {
            preco: dados.preco,
            frete: dados.frete ?? null,
            verificadoEm: new Date(),
          },
        },
      },
      include: {
        produto: { select: { id: true, nome: true, slug: true } },
        hardware: { select: { id: true, nome: true, categoria: true } },
        parceiro: { select: { id: true, nome: true, slug: true } },
      },
    });
  }

  private async listarAtivasProduto(produtoId: number) {
    const agora = new Date();
    return this.prisma.oferta.findMany({
      where: {
        produtoId,
        status: StatusOferta.ATIVA,
        parceiro: { ativo: true },
        OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
      },
      orderBy: { preco: 'asc' },
      select: {
        id: true,
        vendedorNome: true,
        vendedorIdentificador: true,
        preco: true,
        precoAnterior: true,
        frete: true,
        urlOriginal: true,
        urlAfiliada: true,
        validoAte: true,
        verificadoEm: true,
        status: true,
        atualizadoEm: true,
        parceiro: {
          select: {
            id: true,
            nome: true,
            slug: true,
            logoUrl: true,
            programaAfiliados: true,
          },
        },
      },
    });
  }

  async listarOfertasDoProduto(produtoId: number) {
    const produto = await this.prisma.produto.findFirst({
      where: { id: produtoId, ativo: true, publicado: true },
      select: { id: true, nome: true, slug: true },
    });
    if (!produto) throw new NotFoundException('Produto não encontrado.');
    const ofertas = await this.listarAtivasProduto(produtoId);
    return {
      produto,
      total: ofertas.length,
      melhorPreco: ofertas[0]
        ? { preco: ofertas[0].preco, parceiro: ofertas[0].parceiro }
        : null,
      ofertas,
    };
  }

  async listarOfertasDoHardware(hardwareId: number) {
    const hardware = await this.prisma.hardware.findFirst({
      where: { id: hardwareId, ativo: true, publicado: true },
      select: { id: true, nome: true, produtoId: true },
    });
    if (!hardware?.produtoId)
      throw new NotFoundException('Hardware não encontrado.');
    const resultado = await this.listarOfertasDoProduto(hardware.produtoId);
    return { hardware, ...resultado, produto: resultado.produto };
  }

  async atualizarOferta(id: number, dados: AtualizarOfertaDto) {
    const oferta = await this.prisma.oferta.findUnique({
      where: { id },
      select: { id: true, preco: true, frete: true },
    });
    if (!oferta) throw new NotFoundException('Oferta não encontrada.');

    const precoNovo = dados.preco ?? oferta.preco;
    const freteNovo = dados.frete ?? oferta.frete;
    const mudouPrecoOuFrete =
      dados.preco !== undefined || dados.frete !== undefined;

    return this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.oferta.update({
        where: { id },
        data: {
          ...(dados.vendedorNome !== undefined && {
            vendedorNome: dados.vendedorNome.trim() || null,
          }),
          ...(dados.vendedorIdentificador !== undefined && {
            vendedorIdentificador: dados.vendedorIdentificador.trim() || null,
          }),
          ...(dados.urlOriginal !== undefined && {
            urlOriginal: dados.urlOriginal,
          }),
          ...(dados.urlAfiliada !== undefined && {
            urlAfiliada: dados.urlAfiliada,
          }),
          ...(dados.preco !== undefined && {
            preco: dados.preco,
            precoAnterior: dados.precoAnterior ?? oferta.preco,
          }),
          ...(dados.preco === undefined &&
            dados.precoAnterior !== undefined && {
              precoAnterior: dados.precoAnterior,
            }),
          ...(dados.frete !== undefined && { frete: dados.frete }),
          ...(dados.validoAte !== undefined && {
            validoAte: new Date(dados.validoAte),
          }),
          ...(dados.status !== undefined && { status: dados.status }),
          coletadoEm: new Date(),
          verificadoEm: new Date(),
        },
        include: {
          produto: { select: { id: true, nome: true, slug: true } },
          hardware: {
            select: { id: true, nome: true, categoria: true },
          },
          parceiro: { select: { id: true, nome: true, slug: true } },
        },
      });

      if (mudouPrecoOuFrete) {
        await tx.historicoPrecoOferta.create({
          data: {
            ofertaId: id,
            preco: precoNovo,
            frete: freteNovo,
            verificadoEm: new Date(),
          },
        });
      }

      return atualizada;
    });
  }

  async historicoOferta(id: number, exigirProdutoPublico = true) {
    const oferta = await this.prisma.oferta.findUnique({
      where: { id },
      select: {
        id: true,
        produtoId: true,
        status: true,
        validoAte: true,
        parceiro: { select: { ativo: true } },
        produto: {
          select: { id: true, nome: true, ativo: true, publicado: true },
        },
      },
    });

    if (!oferta) throw new NotFoundException('Oferta não encontrada.');
    if (exigirProdutoPublico) {
      const agora = new Date();
      const ofertaValida =
        oferta.status === StatusOferta.ATIVA &&
        oferta.parceiro.ativo &&
        (oferta.validoAte === null || oferta.validoAte >= agora);

      if (!oferta.produto.ativo || !oferta.produto.publicado || !ofertaValida) {
        throw new NotFoundException('Oferta não encontrada.');
      }
    }

    const historico = await this.prisma.historicoPrecoOferta.findMany({
      where: { ofertaId: id },
      orderBy: { verificadoEm: 'asc' },
      select: {
        id: true,
        preco: true,
        frete: true,
        verificadoEm: true,
      },
    });

    return {
      ofertaId: id,
      produto: { id: oferta.produto.id, nome: oferta.produto.nome },
      total: historico.length,
      historico,
    };
  }

  async removerOferta(id: number) {
    const oferta = await this.prisma.oferta.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!oferta) throw new NotFoundException('Oferta não encontrada.');
    await this.prisma.oferta.delete({ where: { id } });
    return { mensagem: 'Oferta removida com sucesso.' };
  }

  async calcularPrecoTotal(hardwareIds: number[]) {
    if (hardwareIds.length === 0) return { total: 0, itens: [] };
    const ofertas = await this.prisma.oferta.findMany({
      where: {
        hardwareId: { in: hardwareIds },
        status: StatusOferta.ATIVA,
        parceiro: { ativo: true },
        OR: [{ validoAte: null }, { validoAte: { gte: new Date() } }],
      },
      orderBy: { preco: 'asc' },
      select: {
        hardwareId: true,
        preco: true,
        urlAfiliada: true,
        urlOriginal: true,
        parceiro: {
          select: { id: true, nome: true, slug: true, logoUrl: true },
        },
        hardware: { select: { id: true, nome: true, categoria: true } },
      },
    });

    const melhorPorHardware = new Map<number, (typeof ofertas)[0]>();
    for (const oferta of ofertas) {
      if (
        oferta.hardwareId !== null &&
        !melhorPorHardware.has(oferta.hardwareId)
      ) {
        melhorPorHardware.set(oferta.hardwareId, oferta);
      }
    }

    const itens = hardwareIds.map((hardwareId) => {
      const melhor = melhorPorHardware.get(hardwareId);
      return {
        hardwareId,
        hardware: melhor?.hardware ?? null,
        melhorOferta: melhor
          ? {
              preco: Number(melhor.preco),
              parceiro: melhor.parceiro,
              url: melhor.urlAfiliada ?? melhor.urlOriginal,
            }
          : null,
      };
    });
    const total = itens.reduce(
      (soma, item) => soma + (item.melhorOferta?.preco ?? 0),
      0,
    );
    const semOferta = itens.filter((item) => item.melhorOferta === null).length;
    return {
      total: Number(total.toFixed(2)),
      semOferta,
      aviso:
        semOferta > 0
          ? `${semOferta} componente(s) sem oferta cadastrada. Preço total pode estar incompleto.`
          : null,
      itens,
    };
  }
}
