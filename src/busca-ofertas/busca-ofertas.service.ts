import { Injectable } from '@nestjs/common';
import { StatusOferta } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificadorOfertasService } from './classificador-ofertas.service';
import {
  FiltrarBuscaOfertasDto,
  OrdenacaoBuscaOferta,
  TagBuscaOferta,
} from './dtos/filtrar-busca-ofertas.dto';

type OfertaBuscaInterna = {
  id: number;
  produtoId: number;
  nome: string;
  descricao: string;
  tag: TagBuscaOferta;
  precoAtual: number;
  precoAnterior: number | null;
  descontoPercentual: number | null;
  url: string;
  imagemUrl: string | null;
  produtoPublicado: boolean;
  parceiro: {
    id: number;
    nome: string;
    slug: string;
  };
  atualizadoEm: string;
};

@Injectable()
export class BuscaOfertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classificadorOfertasService: ClassificadorOfertasService,
  ) {}

  private calcularDesconto(
    precoAtual: number,
    precoAnterior: number | null,
  ): number | null {
    if (
      precoAnterior === null ||
      precoAnterior <= 0 ||
      precoAnterior <= precoAtual
    ) {
      return null;
    }

    return Number(
      (((precoAnterior - precoAtual) / precoAnterior) * 100).toFixed(2),
    );
  }

  private classificarProduto(
    nome: string,
    categoriaNome: string,
    categoriaSlug: string,
  ): TagBuscaOferta {
    const slug = categoriaSlug.toLowerCase();

    if (slug.includes('placa') && slug.includes('video')) {
      return TagBuscaOferta.PLACA_VIDEO;
    }
    if (slug.includes('processador')) return TagBuscaOferta.PROCESSADOR;
    if (slug.includes('placa') && slug.includes('mae')) {
      return TagBuscaOferta.PLACA_MAE;
    }
    if (slug.includes('memoria') && slug.includes('ram')) {
      return TagBuscaOferta.MEMORIA_RAM;
    }
    if (
      slug.includes('ssd') ||
      slug.includes('armazenamento') ||
      slug.includes('storage')
    ) {
      return TagBuscaOferta.SSD;
    }
    if (slug.includes('fonte')) return TagBuscaOferta.FONTE;
    if (slug.includes('gabinete')) return TagBuscaOferta.GABINETE;
    if (slug.includes('monitor')) return TagBuscaOferta.MONITOR;
    if (slug.includes('notebook')) return TagBuscaOferta.NOTEBOOK;
    if (
      slug.includes('celular') ||
      slug.includes('smartphone') ||
      slug.includes('mobile')
    ) {
      return TagBuscaOferta.CELULAR;
    }
    if (
      ['mouse', 'teclado', 'headset', 'fone', 'microfone', 'webcam'].some(
        (termo) => slug.includes(termo),
      )
    ) {
      return TagBuscaOferta.PERIFERICOS;
    }

    return this.classificadorOfertasService.classificar(
      nome,
      `${categoriaNome} ${categoriaSlug}`,
    );
  }

  private async carregarOfertas(): Promise<OfertaBuscaInterna[]> {
    const agora = new Date();
    const ofertas = await this.prisma.oferta.findMany({
      where: {
        status: StatusOferta.ATIVA,
        urlAfiliada: { not: null },
        produto: { ativo: true },
        parceiro: { ativo: true },
        OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
      },
      orderBy: [{ atualizadoEm: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        preco: true,
        precoAnterior: true,
        urlAfiliada: true,
        atualizadoEm: true,
        produto: {
          select: {
            id: true,
            nome: true,
            descricao: true,
            marca: true,
            modelo: true,
            imagemUrl: true,
            publicado: true,
            categoria: {
              select: {
                nome: true,
                slug: true,
              },
            },
          },
        },
        parceiro: {
          select: {
            id: true,
            nome: true,
            slug: true,
          },
        },
      },
    });

    return ofertas.flatMap((oferta) => {
      const url = oferta.urlAfiliada?.trim();
      if (!url) return [];

      const precoAtual = Number(oferta.preco);
      const precoAnterior =
        oferta.precoAnterior === null ? null : Number(oferta.precoAnterior);
      const descricao =
        oferta.produto.descricao?.trim() ||
        [oferta.produto.marca, oferta.produto.modelo]
          .filter(Boolean)
          .join(' ') ||
        oferta.produto.nome;

      return [
        {
          id: oferta.id,
          produtoId: oferta.produto.id,
          nome: oferta.produto.nome,
          descricao,
          tag: this.classificarProduto(
            oferta.produto.nome,
            oferta.produto.categoria.nome,
            oferta.produto.categoria.slug,
          ),
          precoAtual,
          precoAnterior,
          descontoPercentual: this.calcularDesconto(precoAtual, precoAnterior),
          url,
          imagemUrl: oferta.produto.imagemUrl,
          produtoPublicado: oferta.produto.publicado,
          parceiro: oferta.parceiro,
          atualizadoEm: oferta.atualizadoEm.toISOString(),
        },
      ];
    });
  }

  private aplicarFiltros(
    ofertasOriginais: OfertaBuscaInterna[],
    filtros: FiltrarBuscaOfertasDto,
  ): OfertaBuscaInterna[] {
    const busca = filtros.busca?.trim().toLowerCase();
    const tag = filtros.tag ?? filtros.categoria;

    let ofertas = ofertasOriginais.filter((oferta) => {
      if (busca) {
        const alvo =
          `${oferta.nome} ${oferta.descricao} ${oferta.parceiro.nome}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      if (tag && oferta.tag !== tag) return false;
      if (
        filtros.descontoMinimo !== undefined &&
        (oferta.descontoPercentual === null ||
          oferta.descontoPercentual < filtros.descontoMinimo)
      ) {
        return false;
      }
      return true;
    });

    const ordenar = filtros.ordenar ?? OrdenacaoBuscaOferta.MAIOR_DESCONTO;
    ofertas = [...ofertas].sort((a, b) => {
      switch (ordenar) {
        case OrdenacaoBuscaOferta.MENOR_PRECO:
          return a.precoAtual - b.precoAtual;
        case OrdenacaoBuscaOferta.MAIOR_PRECO:
          return b.precoAtual - a.precoAtual;
        case OrdenacaoBuscaOferta.MAIS_RECENTES:
          return b.atualizadoEm.localeCompare(a.atualizadoEm);
        case OrdenacaoBuscaOferta.MAIOR_DESCONTO:
        default:
          return (b.descontoPercentual ?? -1) - (a.descontoPercentual ?? -1);
      }
    });

    return ofertas;
  }

  async listar(filtros: FiltrarBuscaOfertasDto) {
    const todas = await this.carregarOfertas();
    const ofertas = this.aplicarFiltros(todas, filtros);

    return {
      total: ofertas.length,
      ultimaAtualizacao: todas[0]?.atualizadoEm ?? null,
      origem: 'BANCO_CRIABYTE' as const,
      modo: 'PRODUTOS_COM_LINK_AFILIADO' as const,
      ofertas,
    };
  }

  async atualizar(filtros: FiltrarBuscaOfertasDto) {
    return {
      ...(await this.listar(filtros)),
      atualizacaoExecutada: true,
      observacao:
        'Sem API externa: a lista é relida diretamente das Ofertas ativas do CriaByte que possuem link afiliado.',
    };
  }

  async status() {
    const agora = new Date();
    const total = await this.prisma.oferta.count({
      where: {
        status: StatusOferta.ATIVA,
        urlAfiliada: { not: null },
        produto: { ativo: true },
        parceiro: { ativo: true },
        OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
      },
    });

    return {
      origem: 'BANCO_CRIABYTE' as const,
      apiExterna: false,
      modo: 'PRODUTOS_COM_LINK_AFILIADO' as const,
      totalComLinkAfiliado: total,
      regras: {
        criaHardwareAutomaticamente: false,
        criaProdutoAutomaticamente: false,
        criaOfertaAutomaticamente: false,
        apareceQuando:
          'O Produto possui uma Oferta ativa, válida e com urlAfiliada preenchida.',
      },
    };
  }
}
