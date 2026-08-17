import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  CategoriaHardware,
  PapelUsuario,
  StatusBuildComunidade,
  StatusComentarioBuild,
  StatusOferta,
  VisibilidadeBuildComunidade,
} from '../generated/prisma/enums';
import { ApiException } from '../common/exceptions/api.exception';
import { BuildsService } from '../builds/builds.service';
import { BuildComponenteDto } from '../builds/dtos/criar-build.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarBuildComunidadeDto } from './dtos/atualizar-build-comunidade.dto';
import { AtualizarComentarioBuildDto } from './dtos/atualizar-comentario-build.dto';
import { AvaliarBuildComunidadeDto } from './dtos/avaliar-build-comunidade.dto';
import { BuildComunidadeComponenteDto } from './dtos/build-comunidade-componente.dto';
import { CriarBuildComunidadeDto } from './dtos/criar-build-comunidade.dto';
import { CriarComentarioBuildDto } from './dtos/criar-comentario-build.dto';
import {
  FiltrarBuildsComunidadeDto,
  OrdenacaoBuildComunidade,
} from './dtos/filtrar-builds-comunidade.dto';

export type UsuarioComunidade = {
  id: number;
  papel: string;
} | null;

type ComponenteComunidadePreparado = {
  hardwareId: number | null;
  categoria: CategoriaHardware;
  nome: string;
  marca: string | null;
  modelo: string | null;
  imagemUrl: string | null;
  quantidade: number;
  posicao: string | null;
  origem: string | null;
  especificacoes: Record<string, unknown> | null;
  fonteDadosUrl: string | null;
  modelo3dUrl: string | null;
};

@Injectable()
export class ComunidadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly buildsService: BuildsService,
  ) {}

  private criarSlug(texto: string): string {
    return (
      texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'build-comunidade'
    );
  }

  private async criarSlugUnico(titulo: string, ignorarId?: number) {
    const base = this.criarSlug(titulo);
    let slug = base;
    let numero = 2;

    while (true) {
      const existente = await this.prisma.buildComunidade.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existente || existente.id === ignorarId) return slug;
      slug = `${base}-${numero++}`;
    }
  }

  private async calcularPrecoNaPublicacao(
    componentes: ComponenteComunidadePreparado[],
  ): Promise<number | null> {
    if (componentes.length === 0) return null;

    const hardwareIds = [
      ...new Set(
        componentes
          .map((item) => item.hardwareId)
          .filter((id): id is number => id !== null),
      ),
    ];

    // Peças externas sem hardwareId não possuem um preço comercial confiável
    // no catálogo. Nesse caso não gravamos um total parcial como se fosse exato.
    if (
      hardwareIds.length === 0 ||
      componentes.some((item) => item.hardwareId === null)
    ) {
      return null;
    }

    const agora = new Date();
    const ofertas = await this.prisma.oferta.findMany({
      where: {
        hardwareId: { in: hardwareIds },
        status: StatusOferta.ATIVA,
        parceiro: { ativo: true },
        produto: { ativo: true, publicado: true },
        OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
      },
      orderBy: [{ preco: 'asc' }, { id: 'asc' }],
      select: { hardwareId: true, preco: true },
    });

    const menorPrecoPorHardware = new Map<number, number>();
    for (const oferta of ofertas) {
      if (oferta.hardwareId === null) continue;
      if (!menorPrecoPorHardware.has(oferta.hardwareId)) {
        menorPrecoPorHardware.set(oferta.hardwareId, Number(oferta.preco));
      }
    }

    let total = 0;
    for (const componente of componentes) {
      if (componente.hardwareId === null) return null;
      const preco = menorPrecoPorHardware.get(componente.hardwareId);
      if (preco === undefined) return null;
      total += preco * componente.quantidade;
    }

    return Number(total.toFixed(2));
  }

  private includeDetalhado() {
    return {
      usuario: {
        select: {
          id: true,
          nome: true,
        },
      },
      componentes: {
        orderBy: { id: 'asc' as const },
        include: {
          hardware: {
            select: {
              id: true,
              nome: true,
              slug: true,
              categoria: true,
              marca: true,
              modelo: true,
              imagemUrl: true,
              ativo: true,
              publicado: true,
            },
          },
        },
      },
    };
  }

  private ehAdmin(usuario: UsuarioComunidade): boolean {
    return usuario?.papel === PapelUsuario.ADMIN;
  }

  private podeEditar(usuario: UsuarioComunidade, autorId: number): boolean {
    return (
      usuario !== null && (usuario.id === autorId || this.ehAdmin(usuario))
    );
  }

  private jsonComoRegistro(
    valor: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
      ? valor
      : null;
  }

  private async prepararComponentes(
    componentes: BuildComunidadeComponenteDto[],
  ): Promise<ComponenteComunidadePreparado[]> {
    const idsInformados = [
      ...new Set(
        componentes
          .map((item) => item.hardwareId)
          .filter((id): id is number => id !== undefined),
      ),
    ];

    const hardwares =
      idsInformados.length > 0
        ? await this.prisma.hardware.findMany({
            where: { id: { in: idsInformados } },
            select: {
              id: true,
              categoria: true,
              nome: true,
              marca: true,
              modelo: true,
              imagemUrl: true,
              especificacoes: true,
              especificacaoProcessador: true,
              especificacaoPlacaMae: { include: { slotsM2: true } },
              especificacaoMemoriaRam: true,
              especificacaoPlacaVideo: true,
              especificacaoArmazenamento: true,
              especificacaoFonte: true,
              especificacaoGabinete: {
                include: { suportesFans: true, suportesRadiador: true },
              },
              especificacaoCooler: true,
              especificacaoVentoinha: true,
              modelos3D: {
                where: { ativo: true, aprovado: true },
                orderBy: [{ atualizadoEm: 'desc' }, { id: 'desc' }],
                take: 1,
                select: { arquivoUrl: true },
              },
            },
          })
        : [];

    const hardwarePorId = new Map(
      hardwares.map((hardware) => [hardware.id, hardware]),
    );

    return componentes.map((item) => {
      const hardware =
        item.hardwareId !== undefined
          ? hardwarePorId.get(item.hardwareId)
          : undefined;

      if (hardware && hardware.categoria !== item.categoria) {
        throw new BadRequestException(
          `A categoria informada para o hardware ${hardware.id} não corresponde ao cadastro.`,
        );
      }

      // Se o ID informado não existir mais, o componente pode continuar como
      // peça independente do catálogo, desde que possua um nome próprio.
      const nome = item.nome?.trim() || hardware?.nome?.trim();
      if (!nome) {
        throw new BadRequestException(
          `Informe o nome do componente da categoria ${item.categoria} quando ele não estiver vinculado a um Hardware válido.`,
        );
      }

      const especificacoesHardware = hardware
        ? (hardware.especificacaoProcessador ??
          hardware.especificacaoPlacaMae ??
          hardware.especificacaoMemoriaRam ??
          hardware.especificacaoPlacaVideo ??
          hardware.especificacaoArmazenamento ??
          hardware.especificacaoFonte ??
          hardware.especificacaoGabinete ??
          hardware.especificacaoCooler ??
          hardware.especificacaoVentoinha ??
          hardware.especificacoes)
        : null;

      const especificacoesInformadas = item.especificacoes ?? null;
      const especificacoes =
        especificacoesInformadas ??
        (especificacoesHardware !== null &&
        typeof especificacoesHardware === 'object' &&
        !Array.isArray(especificacoesHardware)
          ? { ...especificacoesHardware }
          : null);

      return {
        hardwareId: hardware?.id ?? null,
        categoria: item.categoria,
        nome,
        marca: item.marca?.trim() || hardware?.marca?.trim() || null,
        modelo: item.modelo?.trim() || hardware?.modelo?.trim() || null,
        imagemUrl:
          item.imagemUrl?.trim() || hardware?.imagemUrl?.trim() || null,
        quantidade: item.quantidade ?? 1,
        posicao: item.posicao?.trim() || null,
        origem:
          item.origem ??
          (hardware ? 'CATALOGO' : item.hardwareId ? 'EXTERNO' : 'EXTERNO'),
        especificacoes,
        fonteDadosUrl: item.fonteDadosUrl?.trim() || null,
        modelo3dUrl:
          item.modelo3dUrl?.trim() ||
          hardware?.modelos3D[0]?.arquivoUrl ||
          null,
      };
    });
  }

  private dadosSnapshotPersistencia(item: ComponenteComunidadePreparado) {
    return {
      origem: item.origem,
      ...(item.especificacoes !== null && {
        especificacoes: item.especificacoes as Prisma.InputJsonValue,
      }),
      fonteDadosUrl: item.fonteDadosUrl,
      modelo3dUrl: item.modelo3dUrl,
    };
  }

  private analisarCompatibilidadeSnapshotComunidade(
    componentes: ComponenteComunidadePreparado[],
  ) {
    const erros: string[] = [];
    const alertas: string[] = [];
    let verificacoes = 0;
    let pendentes = 0;

    const primeiro = (categoria: CategoriaHardware) =>
      componentes.find((item) => item.categoria === categoria);
    const todos = (categoria: CategoriaHardware) =>
      componentes.filter((item) => item.categoria === categoria);
    const texto = (
      componente: ComponenteComunidadePreparado | undefined,
      chave: string,
    ) => {
      const valor = componente?.especificacoes?.[chave];
      return typeof valor === 'string' && valor.trim()
        ? valor.trim()
        : undefined;
    };
    const numero = (
      componente: ComponenteComunidadePreparado | undefined,
      chave: string,
    ) => {
      const valor = componente?.especificacoes?.[chave];
      return typeof valor === 'number' && Number.isFinite(valor)
        ? valor
        : undefined;
    };
    const booleano = (
      componente: ComponenteComunidadePreparado | undefined,
      chave: string,
    ) => {
      const valor = componente?.especificacoes?.[chave];
      return typeof valor === 'boolean' ? valor : undefined;
    };
    const lista = (
      componente: ComponenteComunidadePreparado | undefined,
      chave: string,
    ) => {
      const valor = componente?.especificacoes?.[chave];
      return Array.isArray(valor)
        ? valor.filter((item): item is string => typeof item === 'string')
        : [];
    };

    const cpu = primeiro(CategoriaHardware.PROCESSADOR);
    const placaMae = primeiro(CategoriaHardware.PLACA_MAE);
    const gpu = primeiro(CategoriaHardware.PLACA_VIDEO);
    const fonte = primeiro(CategoriaHardware.FONTE);
    const gabinete = primeiro(CategoriaHardware.GABINETE);
    const cooler = primeiro(CategoriaHardware.COOLER);
    const memorias = todos(CategoriaHardware.MEMORIA_RAM);

    if (cpu && placaMae) {
      const socketCpu = texto(cpu, 'socket');
      const socketPlaca = texto(placaMae, 'socket');
      if (socketCpu && socketPlaca) {
        verificacoes++;
        if (socketCpu.toUpperCase() !== socketPlaca.toUpperCase()) {
          erros.push(
            `CPU usa socket ${socketCpu}, mas a placa-mãe usa ${socketPlaca}.`,
          );
        }
      } else {
        pendentes++;
        alertas.push('Socket de CPU/placa-mãe não pôde ser confirmado.');
      }
    }

    if (placaMae && memorias.length > 0) {
      const tipos = lista(placaMae, 'tiposMemoriaSuportados').map((item) =>
        item.toUpperCase(),
      );
      const formatos = lista(placaMae, 'formatosMemoriaSuportados').map(
        (item) => item.toUpperCase(),
      );
      const slots = numero(placaMae, 'slotsMemoria');
      let modulos = 0;

      for (const memoria of memorias) {
        const tipo = texto(memoria, 'tipo');
        const formato = texto(memoria, 'formato');
        const modulosPorKit = numero(memoria, 'quantidadeModulos') ?? 1;
        modulos += modulosPorKit * memoria.quantidade;

        if (tipo && tipos.length > 0) {
          verificacoes++;
          if (!tipos.includes(tipo.toUpperCase())) {
            erros.push(
              `A memória ${memoria.nome} é ${tipo}, não suportada pela placa-mãe.`,
            );
          }
        } else {
          pendentes++;
        }

        if (formato && formatos.length > 0) {
          verificacoes++;
          if (!formatos.includes(formato.toUpperCase())) {
            erros.push(
              `O formato ${formato} de ${memoria.nome} não é suportado pela placa-mãe.`,
            );
          }
        }
      }

      if (slots !== undefined) {
        verificacoes++;
        if (modulos > slots) {
          erros.push(
            `A build usa ${modulos} módulos de RAM, mas a placa-mãe possui ${slots} slots.`,
          );
        }
      }
    }

    if (placaMae && gabinete) {
      const formato = texto(placaMae, 'formato');
      const suportados = lista(gabinete, 'formatosPlacaMaeSuportados').map(
        (item) => item.toUpperCase(),
      );
      if (formato && suportados.length > 0) {
        verificacoes++;
        if (!suportados.includes(formato.toUpperCase())) {
          erros.push(`O gabinete não suporta placa-mãe ${formato}.`);
        }
      } else {
        pendentes++;
      }
    }

    if (gpu && gabinete) {
      const comprimento = numero(gpu, 'comprimentoMm');
      const maximo = numero(gabinete, 'comprimentoMaximoGpuMm');
      if (comprimento !== undefined && maximo !== undefined) {
        verificacoes++;
        if (comprimento > maximo) {
          erros.push(
            `A GPU possui ${comprimento} mm e excede o limite de ${maximo} mm do gabinete.`,
          );
        }
      } else {
        pendentes++;
      }
    }

    if (gpu && fonte) {
      const potencia = numero(fonte, 'potenciaWatts');
      const recomendada = numero(gpu, 'potenciaFonteRecomendadaWatts');
      if (potencia !== undefined && recomendada !== undefined) {
        verificacoes++;
        if (potencia < recomendada) {
          erros.push(
            `A GPU recomenda fonte de ${recomendada} W, mas a fonte possui ${potencia} W.`,
          );
        }
      } else {
        pendentes++;
      }
    }

    if (cpu && cooler) {
      const socketCpu = texto(cpu, 'socket');
      const sockets = lista(cooler, 'socketsSuportados').map((item) =>
        item.toUpperCase(),
      );
      if (socketCpu && sockets.length > 0) {
        verificacoes++;
        if (!sockets.includes(socketCpu.toUpperCase())) {
          erros.push(`O cooler não suporta o socket ${socketCpu} da CPU.`);
        }
      } else {
        pendentes++;
      }
    }

    if (cpu && !gpu) {
      const possuiVideo = booleano(cpu, 'possuiVideoIntegrado');
      if (possuiVideo === false) {
        verificacoes++;
        erros.push(
          'A CPU não possui vídeo integrado e a build não possui placa de vídeo.',
        );
      } else if (possuiVideo === undefined) {
        pendentes++;
        alertas.push(
          'Sem GPU dedicada, confirme se a CPU possui vídeo integrado.',
        );
      }
    }

    const status =
      erros.length > 0
        ? 'INCOMPATIVEL'
        : verificacoes === 0
          ? 'DADOS_INSUFICIENTES'
          : pendentes > 0
            ? 'COMPATIBILIDADE_PARCIAL'
            : 'COMPATIVEL';

    return {
      status,
      erros,
      alertas,
      verificacoesRealizadas: verificacoes,
      verificacoesPendentes: pendentes,
    } as const;
  }

  private componentesVinculadosParaNucleo(
    componentes: ComponenteComunidadePreparado[],
  ): BuildComponenteDto[] {
    return componentes.flatMap((item) =>
      item.hardwareId === null
        ? []
        : [
            {
              hardwareId: item.hardwareId,
              categoria: item.categoria,
              quantidade: item.quantidade,
              posicao: item.posicao ?? undefined,
            },
          ],
    );
  }

  private validarCompletudePublicacao(
    componentes: ComponenteComunidadePreparado[],
  ): void {
    const obrigatorias = [
      CategoriaHardware.PROCESSADOR,
      CategoriaHardware.PLACA_MAE,
      CategoriaHardware.MEMORIA_RAM,
      CategoriaHardware.ARMAZENAMENTO,
      CategoriaHardware.FONTE,
      CategoriaHardware.GABINETE,
    ];

    const categorias = new Set(componentes.map((item) => item.categoria));
    const ausentes = obrigatorias.filter(
      (categoria) => !categorias.has(categoria),
    );

    if (ausentes.length > 0) {
      throw new BadRequestException(
        `Uma build publicada precisa conter: ${ausentes.join(', ')}.`,
      );
    }

    const categoriasUnitarias = [
      CategoriaHardware.PROCESSADOR,
      CategoriaHardware.PLACA_MAE,
      CategoriaHardware.FONTE,
      CategoriaHardware.GABINETE,
    ];

    for (const categoria of categoriasUnitarias) {
      const quantidade = componentes
        .filter((item) => item.categoria === categoria)
        .reduce((total, item) => total + item.quantidade, 0);

      if (quantidade !== 1) {
        throw new BadRequestException(
          `Uma build publicada deve possuir exatamente uma unidade da categoria ${categoria}.`,
        );
      }
    }

    const categoriasNoMaximoUma = [
      CategoriaHardware.PLACA_VIDEO,
      CategoriaHardware.COOLER,
    ];

    for (const categoria of categoriasNoMaximoUma) {
      const quantidade = componentes
        .filter((item) => item.categoria === categoria)
        .reduce((total, item) => total + item.quantidade, 0);

      if (quantidade > 1) {
        throw new BadRequestException(
          `Uma build publicada suporta no máximo uma unidade da categoria ${categoria}.`,
        );
      }
    }
  }

  private async analisarCompatibilidadeSePossivel(
    componentes: ComponenteComunidadePreparado[],
  ): Promise<Awaited<
    ReturnType<BuildsService['analisarCompatibilidadeComponentes']>
  > | null> {
    // O diagnóstico técnico completo só é executado quando todos os itens
    // continuam vinculados a Hardwares ativos e publicados. A falta desse
    // vínculo nunca impede uma Build da Comunidade de existir ou ser publicada.
    if (
      componentes.length === 0 ||
      componentes.some((item) => item.hardwareId === null)
    ) {
      return null;
    }

    const componentesNucleo = this.componentesVinculadosParaNucleo(componentes);
    const ids = [...new Set(componentesNucleo.map((item) => item.hardwareId))];

    const quantidadePublicada = await this.prisma.hardware.count({
      where: {
        id: { in: ids },
        ativo: true,
        publicado: true,
      },
    });

    if (quantidadePublicada !== ids.length) return null;

    return this.buildsService.analisarCompatibilidadeComponentes(
      componentesNucleo,
    );
  }

  private async obterResumosInteracoes(buildIds: number[]) {
    const resumos = new Map<
      number,
      {
        mediaAvaliacoes: number | null;
        quantidadeAvaliacoes: number;
        quantidadeComentarios: number;
      }
    >();

    for (const buildId of buildIds) {
      resumos.set(buildId, {
        mediaAvaliacoes: null,
        quantidadeAvaliacoes: 0,
        quantidadeComentarios: 0,
      });
    }

    if (buildIds.length === 0) return resumos;

    const [avaliacoes, comentarios] = await Promise.all([
      this.prisma.avaliacaoBuild.groupBy({
        by: ['buildId'],
        where: { buildId: { in: buildIds } },
        _avg: { nota: true },
        _count: { _all: true },
      }),
      this.prisma.comentarioBuild.groupBy({
        by: ['buildId'],
        where: {
          buildId: { in: buildIds },
          status: StatusComentarioBuild.PUBLICADO,
        },
        _count: { _all: true },
      }),
    ]);

    for (const avaliacao of avaliacoes) {
      resumos.set(avaliacao.buildId, {
        ...(resumos.get(avaliacao.buildId) ?? {
          quantidadeComentarios: 0,
        }),
        mediaAvaliacoes: avaliacao._avg.nota ?? null,
        quantidadeAvaliacoes: avaliacao._count._all,
      });
    }

    for (const comentario of comentarios) {
      const atual = resumos.get(comentario.buildId);
      resumos.set(comentario.buildId, {
        mediaAvaliacoes: atual?.mediaAvaliacoes ?? null,
        quantidadeAvaliacoes: atual?.quantidadeAvaliacoes ?? 0,
        quantidadeComentarios: comentario._count._all,
      });
    }

    return resumos;
  }

  private async obterResumoInteracoes(buildId: number) {
    const resumos = await this.obterResumosInteracoes([buildId]);
    return (
      resumos.get(buildId) ?? {
        mediaAvaliacoes: null,
        quantidadeAvaliacoes: 0,
        quantidadeComentarios: 0,
      }
    );
  }

  private async obterBuildParaInteracao(
    id: number,
    usuario: UsuarioComunidade,
  ) {
    const build = await this.prisma.buildComunidade.findUnique({
      where: { id },
      select: {
        id: true,
        usuarioId: true,
        status: true,
        visibilidade: true,
      },
    });

    if (!build || build.status !== StatusBuildComunidade.PUBLICADA) {
      throw new NotFoundException('Build da comunidade não encontrada.');
    }

    if (
      build.visibilidade === VisibilidadeBuildComunidade.PRIVADA &&
      !this.podeEditar(usuario, build.usuarioId)
    ) {
      throw new NotFoundException('Build da comunidade não encontrada.');
    }

    return build;
  }

  private formatarComentarioRemovido<
    T extends {
      status: StatusComentarioBuild;
      texto: string;
    },
  >(comentario: T) {
    return comentario.status === StatusComentarioBuild.REMOVIDO
      ? { ...comentario, texto: null, removido: true }
      : { ...comentario, removido: false };
  }

  private async obterParaEdicao(id: number, usuario: UsuarioComunidade) {
    const build = await this.prisma.buildComunidade.findUnique({
      where: { id },
      include: { componentes: true },
    });

    if (!build || build.status === StatusBuildComunidade.REMOVIDA) {
      throw new NotFoundException('Build da comunidade não encontrada.');
    }

    if (!this.podeEditar(usuario, build.usuarioId)) {
      throw new ForbiddenException('Você não pode alterar esta build.');
    }

    return build;
  }

  async criar(usuarioId: number, dados: CriarBuildComunidadeDto) {
    const componentesInformados = dados.componentes ?? [];
    const componentes = await this.prepararComponentes(componentesInformados);

    const titulo = dados.titulo.trim();
    if (titulo.length < 3) {
      throw new BadRequestException(
        'O título da build deve ter pelo menos 3 caracteres úteis.',
      );
    }
    const slug = await this.criarSlugUnico(titulo);

    const build = await this.prisma.buildComunidade.create({
      data: {
        usuarioId,
        titulo,
        slug,
        descricao: dados.descricao?.trim() || null,
        finalidade: dados.finalidade?.trim() || null,
        resolucao: dados.resolucao?.trim() || null,
        visibilidade: dados.visibilidade ?? VisibilidadeBuildComunidade.PRIVADA,
        status: StatusBuildComunidade.RASCUNHO,
        ...(componentes.length > 0 && {
          componentes: {
            create: componentes.map((item) => ({
              hardwareId: item.hardwareId,
              categoria: item.categoria,
              nome: item.nome,
              marca: item.marca,
              modelo: item.modelo,
              imagemUrl: item.imagemUrl,
              quantidade: item.quantidade,
              posicao: item.posicao,
              ...this.dadosSnapshotPersistencia(item),
            })),
          },
        }),
      },
      include: this.includeDetalhado(),
    });

    return {
      ...build,
      mediaAvaliacoes: null,
      quantidadeAvaliacoes: 0,
      quantidadeComentarios: 0,
    };
  }

  async listarPublicas(filtros: FiltrarBuildsComunidadeDto) {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 24;
    const and: Prisma.BuildComunidadeWhereInput[] = [];

    if (filtros.processador !== undefined) {
      and.push({
        componentes: {
          some: {
            hardwareId: filtros.processador,
            categoria: CategoriaHardware.PROCESSADOR,
          },
        },
      });
    }

    if (filtros.gpu !== undefined) {
      and.push({
        componentes: {
          some: {
            hardwareId: filtros.gpu,
            categoria: CategoriaHardware.PLACA_VIDEO,
          },
        },
      });
    }

    const where: Prisma.BuildComunidadeWhereInput = {
      status: StatusBuildComunidade.PUBLICADA,
      visibilidade: VisibilidadeBuildComunidade.PUBLICA,
      ...(filtros.busca && {
        OR: [
          { titulo: { contains: filtros.busca, mode: 'insensitive' } },
          { descricao: { contains: filtros.busca, mode: 'insensitive' } },
        ],
      }),
      ...(filtros.finalidade && {
        finalidade: { contains: filtros.finalidade, mode: 'insensitive' },
      }),
      ...(filtros.resolucao && {
        resolucao: { contains: filtros.resolucao, mode: 'insensitive' },
      }),
      ...(and.length > 0 && { AND: and }),
    };

    const orderBy: Prisma.BuildComunidadeOrderByWithRelationInput[] =
      filtros.ordenar === OrdenacaoBuildComunidade.MAIS_COPIADAS
        ? [{ quantidadeCopias: 'desc' }, { publicadoEm: 'desc' }]
        : [{ publicadoEm: 'desc' }, { criadoEm: 'desc' }];

    const [total, builds] = await Promise.all([
      this.prisma.buildComunidade.count({ where }),
      this.prisma.buildComunidade.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy,
        include: this.includeDetalhado(),
      }),
    ]);

    const resumosInteracoes = await this.obterResumosInteracoes(
      builds.map((build) => build.id),
    );
    const dados = builds.map((build) => ({
      ...build,
      ...(resumosInteracoes.get(build.id) ?? {
        mediaAvaliacoes: null,
        quantidadeAvaliacoes: 0,
        quantidadeComentarios: 0,
      }),
    }));

    return {
      dados,
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  async listarMinhas(usuarioId: number) {
    const builds = await this.prisma.buildComunidade.findMany({
      where: {
        usuarioId,
        status: { not: StatusBuildComunidade.REMOVIDA },
      },
      orderBy: { atualizadoEm: 'desc' },
      include: this.includeDetalhado(),
    });

    const resumosInteracoes = await this.obterResumosInteracoes(
      builds.map((build) => build.id),
    );
    const buildsComInteracoes = builds.map((build) => ({
      ...build,
      ...(resumosInteracoes.get(build.id) ?? {
        mediaAvaliacoes: null,
        quantidadeAvaliacoes: 0,
        quantidadeComentarios: 0,
      }),
    }));

    return {
      total: buildsComInteracoes.length,
      builds: buildsComInteracoes,
    };
  }

  async buscar(id: number, usuario: UsuarioComunidade) {
    const build = await this.prisma.buildComunidade.findUnique({
      where: { id },
      include: this.includeDetalhado(),
    });

    if (!build) {
      throw new NotFoundException('Build da comunidade não encontrada.');
    }

    if (
      build.status === StatusBuildComunidade.REMOVIDA &&
      !this.ehAdmin(usuario)
    ) {
      throw new NotFoundException('Build da comunidade não encontrada.');
    }

    const publicadaPorLink =
      build.status === StatusBuildComunidade.PUBLICADA &&
      build.visibilidade !== VisibilidadeBuildComunidade.PRIVADA;

    if (!publicadaPorLink && !this.podeEditar(usuario, build.usuarioId)) {
      throw new NotFoundException('Build da comunidade não encontrada.');
    }

    if (publicadaPorLink && usuario?.id !== build.usuarioId) {
      const atualizada = await this.prisma.buildComunidade.update({
        where: { id },
        data: { visualizacoes: { increment: 1 } },
        select: { visualizacoes: true },
      });
      return {
        ...build,
        visualizacoes: atualizada.visualizacoes,
        ...(await this.obterResumoInteracoes(build.id)),
      };
    }

    return {
      ...build,
      ...(await this.obterResumoInteracoes(build.id)),
    };
  }

  async atualizar(
    id: number,
    usuario: UsuarioComunidade,
    dados: AtualizarBuildComunidadeDto,
  ) {
    const atual = await this.obterParaEdicao(id, usuario);

    if (dados.status === StatusBuildComunidade.REMOVIDA) {
      throw new BadRequestException(
        'Use a exclusão da build para alterar o status para REMOVIDA.',
      );
    }

    if (
      dados.status === StatusBuildComunidade.OCULTA &&
      !this.ehAdmin(usuario)
    ) {
      throw new ForbiddenException(
        'Somente um administrador pode ocultar uma build.',
      );
    }

    if (
      atual.status === StatusBuildComunidade.OCULTA &&
      dados.status !== undefined &&
      dados.status !== StatusBuildComunidade.OCULTA &&
      !this.ehAdmin(usuario)
    ) {
      throw new ForbiddenException(
        'Uma build ocultada pela moderação só pode ter o status alterado por administrador.',
      );
    }

    const statusFinal = dados.status ?? atual.status;
    const componentesAtualizados = dados.componentes;
    const componentesFinais: ComponenteComunidadePreparado[] =
      componentesAtualizados !== undefined
        ? await this.prepararComponentes(componentesAtualizados)
        : atual.componentes.map((item) => ({
            hardwareId: item.hardwareId,
            categoria: item.categoria,
            nome: item.nome,
            marca: item.marca,
            modelo: item.modelo,
            imagemUrl: item.imagemUrl,
            quantidade: item.quantidade,
            posicao: item.posicao,
            origem: item.origem,
            especificacoes: this.jsonComoRegistro(item.especificacoes),
            fonteDadosUrl: item.fonteDadosUrl,
            modelo3dUrl: item.modelo3dUrl,
          }));

    let compatibilidadePublicacao: Awaited<
      ReturnType<BuildsService['analisarCompatibilidadeComponentes']>
    > | null = null;
    let compatibilidadeSnapshot: ReturnType<
      ComunidadeService['analisarCompatibilidadeSnapshotComunidade']
    > | null = null;

    const precisaRevalidarPublicacao =
      statusFinal === StatusBuildComunidade.PUBLICADA &&
      (atual.status !== StatusBuildComunidade.PUBLICADA ||
        componentesAtualizados !== undefined);

    if (precisaRevalidarPublicacao) {
      // A completude depende das categorias da peça, não da existência de um
      // registro correspondente na tabela Hardware.
      this.validarCompletudePublicacao(componentesFinais);

      compatibilidadeSnapshot =
        this.analisarCompatibilidadeSnapshotComunidade(componentesFinais);

      if (compatibilidadeSnapshot.status === 'INCOMPATIVEL') {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'BUILD_COMUNIDADE_INCOMPATIVEL',
          'A build possui incompatibilidades críticas conhecidas nos dados técnicos informados.',
          { compatibilidade: compatibilidadeSnapshot },
        );
      }

      compatibilidadePublicacao =
        await this.analisarCompatibilidadeSePossivel(componentesFinais);

      if (compatibilidadePublicacao?.status === 'INCOMPATIVEL') {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'BUILD_COMUNIDADE_INCOMPATIVEL',
          'A build possui incompatibilidades críticas e não pode ser publicada.',
          { compatibilidade: compatibilidadePublicacao },
        );
      }
    }

    const titulo = dados.titulo?.trim();
    if (titulo !== undefined && titulo.length < 3) {
      throw new BadRequestException(
        'O título da build deve ter pelo menos 3 caracteres úteis.',
      );
    }
    const slug =
      titulo !== undefined
        ? await this.criarSlugUnico(titulo, atual.id)
        : undefined;
    const publicandoAgora =
      statusFinal === StatusBuildComunidade.PUBLICADA &&
      atual.status !== StatusBuildComunidade.PUBLICADA;
    const precoNaPublicacao = publicandoAgora
      ? await this.calcularPrecoNaPublicacao(componentesFinais)
      : undefined;

    const build = await this.prisma.$transaction(async (tx) => {
      if (componentesAtualizados !== undefined) {
        await tx.buildComunidadeComponente.deleteMany({
          where: { buildId: id },
        });

        if (componentesFinais.length > 0) {
          await tx.buildComunidadeComponente.createMany({
            data: componentesFinais.map((item) => ({
              buildId: id,
              hardwareId: item.hardwareId,
              categoria: item.categoria,
              nome: item.nome,
              marca: item.marca,
              modelo: item.modelo,
              imagemUrl: item.imagemUrl,
              quantidade: item.quantidade,
              posicao: item.posicao,
              ...this.dadosSnapshotPersistencia(item),
            })),
          });
        }
      }

      await tx.buildComunidade.update({
        where: { id },
        data: {
          ...(titulo !== undefined && { titulo }),
          ...(slug !== undefined && { slug }),
          ...(dados.descricao !== undefined && {
            descricao: dados.descricao.trim() || null,
          }),
          ...(dados.finalidade !== undefined && {
            finalidade: dados.finalidade.trim() || null,
          }),
          ...(dados.resolucao !== undefined && {
            resolucao: dados.resolucao.trim() || null,
          }),
          ...(dados.visibilidade !== undefined && {
            visibilidade: dados.visibilidade,
          }),
          ...(dados.status !== undefined && { status: dados.status }),
          ...(precisaRevalidarPublicacao && {
            consumoNaPublicacao:
              compatibilidadePublicacao?.consumoEnergia.consumoEstimadoWatts ??
              null,
          }),
          ...(publicandoAgora && {
            publicadoEm: new Date(),
            precoNaPublicacao,
          }),
        },
      });

      return tx.buildComunidade.findUniqueOrThrow({
        where: { id },
        include: this.includeDetalhado(),
      });
    });

    return {
      ...build,
      compatibilidadePublicacao,
      compatibilidadeSnapshot,
      ...(await this.obterResumoInteracoes(build.id)),
    };
  }

  async copiar(id: number, usuarioId: number, usuario: UsuarioComunidade) {
    const origem = await this.prisma.buildComunidade.findUnique({
      where: { id },
      include: { componentes: { orderBy: { id: 'asc' } } },
    });

    if (!origem || origem.status === StatusBuildComunidade.REMOVIDA) {
      throw new NotFoundException('Build da comunidade não encontrada.');
    }

    const acessivelPorLink =
      origem.status === StatusBuildComunidade.PUBLICADA &&
      origem.visibilidade !== VisibilidadeBuildComunidade.PRIVADA;

    if (!acessivelPorLink && !this.podeEditar(usuario, origem.usuarioId)) {
      throw new NotFoundException('Build da comunidade não encontrada.');
    }

    const prefixo = 'Cópia de ';
    const titulo = `${prefixo}${origem.titulo.slice(0, 200 - prefixo.length)}`;
    const slug = await this.criarSlugUnico(titulo);

    const resultado = await this.prisma.$transaction(async (tx) => {
      const novaBuild = await tx.buildComunidade.create({
        data: {
          usuarioId,
          titulo,
          slug,
          descricao: origem.descricao,
          finalidade: origem.finalidade,
          resolucao: origem.resolucao,
          visibilidade: VisibilidadeBuildComunidade.PRIVADA,
          status: StatusBuildComunidade.RASCUNHO,
          ...(origem.componentes.length > 0 && {
            componentes: {
              create: origem.componentes.map((item) => ({
                hardwareId: item.hardwareId,
                categoria: item.categoria,
                nome: item.nome,
                marca: item.marca,
                modelo: item.modelo,
                imagemUrl: item.imagemUrl,
                quantidade: item.quantidade,
                posicao: item.posicao,
                origem: item.origem,
                ...(item.especificacoes !== null && {
                  especificacoes: item.especificacoes,
                }),
                fonteDadosUrl: item.fonteDadosUrl,
                modelo3dUrl: item.modelo3dUrl,
              })),
            },
          }),
        },
        include: this.includeDetalhado(),
      });

      const originalAtualizada = await tx.buildComunidade.update({
        where: { id },
        data: { quantidadeCopias: { increment: 1 } },
        select: { quantidadeCopias: true },
      });

      return { novaBuild, originalAtualizada };
    });

    return {
      ...resultado.novaBuild,
      buildOriginalId: id,
      quantidadeCopiasOriginal: resultado.originalAtualizada.quantidadeCopias,
      mediaAvaliacoes: null,
      quantidadeAvaliacoes: 0,
      quantidadeComentarios: 0,
    };
  }

  async avaliar(
    id: number,
    usuarioId: number,
    usuario: UsuarioComunidade,
    dados: AvaliarBuildComunidadeDto,
  ) {
    await this.obterBuildParaInteracao(id, usuario);

    try {
      const avaliacao = await this.prisma.avaliacaoBuild.create({
        data: {
          buildId: id,
          usuarioId,
          nota: dados.nota,
        },
        select: {
          id: true,
          buildId: true,
          usuarioId: true,
          nota: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      });

      return {
        avaliacao,
        ...(await this.obterResumoInteracoes(id)),
      };
    } catch (erro: unknown) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException(
          'Você já avaliou esta build. A avaliação não pode ser alterada.',
        );
      }
      throw erro;
    }
  }

  async listarComentarios(id: number, usuario: UsuarioComunidade) {
    await this.obterBuildParaInteracao(id, usuario);

    const comentarios = await this.prisma.comentarioBuild.findMany({
      where: {
        buildId: id,
        comentarioPaiId: null,
        status: {
          in: [StatusComentarioBuild.PUBLICADO, StatusComentarioBuild.REMOVIDO],
        },
      },
      orderBy: { criadoEm: 'asc' },
      include: {
        usuario: { select: { id: true, nome: true } },
        respostas: {
          where: {
            status: {
              in: [
                StatusComentarioBuild.PUBLICADO,
                StatusComentarioBuild.REMOVIDO,
              ],
            },
          },
          orderBy: { criadoEm: 'asc' },
          include: {
            usuario: { select: { id: true, nome: true } },
          },
        },
      },
    });

    return {
      buildId: id,
      total: comentarios.reduce(
        (total, comentario) => total + 1 + comentario.respostas.length,
        0,
      ),
      comentarios: comentarios.map((comentario) => ({
        ...this.formatarComentarioRemovido(comentario),
        respostas: comentario.respostas.map((resposta) =>
          this.formatarComentarioRemovido(resposta),
        ),
      })),
    };
  }

  async criarComentario(
    id: number,
    usuarioId: number,
    usuario: UsuarioComunidade,
    dados: CriarComentarioBuildDto,
  ) {
    await this.obterBuildParaInteracao(id, usuario);

    const texto = dados.texto.trim();
    if (!texto) {
      throw new BadRequestException('O comentário não pode ficar vazio.');
    }

    if (dados.comentarioPaiId !== undefined) {
      const pai = await this.prisma.comentarioBuild.findUnique({
        where: { id: dados.comentarioPaiId },
        select: {
          buildId: true,
          comentarioPaiId: true,
          status: true,
        },
      });

      if (
        !pai ||
        pai.buildId !== id ||
        pai.status !== StatusComentarioBuild.PUBLICADO
      ) {
        throw new BadRequestException('Comentário pai inválido.');
      }

      if (pai.comentarioPaiId !== null) {
        throw new BadRequestException(
          'A comunidade permite somente comentário e uma resposta.',
        );
      }
    }

    const comentario = await this.prisma.comentarioBuild.create({
      data: {
        buildId: id,
        usuarioId,
        comentarioPaiId: dados.comentarioPaiId ?? null,
        texto,
      },
      include: {
        usuario: { select: { id: true, nome: true } },
      },
    });

    return {
      ...comentario,
      removido: false,
    };
  }

  async atualizarComentario(
    id: number,
    usuario: UsuarioComunidade,
    dados: AtualizarComentarioBuildDto,
  ) {
    const comentario = await this.prisma.comentarioBuild.findUnique({
      where: { id },
      select: {
        id: true,
        usuarioId: true,
        status: true,
      },
    });

    if (!comentario || comentario.status === StatusComentarioBuild.REMOVIDO) {
      throw new NotFoundException('Comentário não encontrado.');
    }

    if (dados.texto === undefined && dados.status === undefined) {
      throw new BadRequestException('Nenhuma alteração foi informada.');
    }

    if (dados.texto !== undefined && usuario?.id !== comentario.usuarioId) {
      throw new ForbiddenException(
        'Somente o autor pode editar o texto do comentário.',
      );
    }

    if (dados.status !== undefined && !this.ehAdmin(usuario)) {
      throw new ForbiddenException(
        'Somente um administrador pode moderar comentários.',
      );
    }

    if (dados.status === StatusComentarioBuild.REMOVIDO) {
      throw new BadRequestException(
        'Use a exclusão do comentário para alterar o status para REMOVIDO.',
      );
    }

    const texto = dados.texto?.trim();
    if (dados.texto !== undefined && !texto) {
      throw new BadRequestException('O comentário não pode ficar vazio.');
    }

    return this.prisma.comentarioBuild.update({
      where: { id },
      data: {
        ...(texto !== undefined && { texto }),
        ...(dados.status !== undefined && { status: dados.status }),
      },
      include: {
        usuario: { select: { id: true, nome: true } },
      },
    });
  }

  async removerComentario(id: number, usuario: UsuarioComunidade) {
    const comentario = await this.prisma.comentarioBuild.findUnique({
      where: { id },
      select: {
        id: true,
        usuarioId: true,
        status: true,
      },
    });

    if (!comentario || comentario.status === StatusComentarioBuild.REMOVIDO) {
      throw new NotFoundException('Comentário não encontrado.');
    }

    if (usuario?.id !== comentario.usuarioId && !this.ehAdmin(usuario)) {
      throw new ForbiddenException('Você não pode remover este comentário.');
    }

    const removido = await this.prisma.comentarioBuild.update({
      where: { id },
      data: { status: StatusComentarioBuild.REMOVIDO },
      select: {
        id: true,
        buildId: true,
        status: true,
      },
    });

    return {
      ...removido,
      removido: true,
    };
  }

  async remover(id: number, usuario: UsuarioComunidade) {
    await this.obterParaEdicao(id, usuario);

    const build = await this.prisma.buildComunidade.update({
      where: { id },
      data: { status: StatusBuildComunidade.REMOVIDA },
      select: {
        id: true,
        slug: true,
        status: true,
      },
    });

    return {
      ...build,
      removida: true,
    };
  }
}
