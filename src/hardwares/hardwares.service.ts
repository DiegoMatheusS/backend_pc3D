import {
  obterCabecalhoHttp,
  requisitarUrlPublicaUmaVez,
  validarUrlPublica,
} from '../common/security/external-http-security';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  CategoriaHardware,
  ChaveM2,
  FormatoArmazenamento,
  InterfaceArmazenamento,
  PosicaoRefrigeracaoGabinete,
  StatusAvaliacao,
  StatusOferta,
  TipoCooler,
  FormatoModelo3D,
  OrigemModelo3D,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../storage/r2-storage.service';
import { normalizarEspecificacoesHardwarePublicas } from '../produtos/normalizar-especificacoes-hardware';
import { AtualizarHardwareDto } from './dtos/atualizar-hardware.dto';
import { CriarCompatibilidadeCpuPlacaMaeDto } from './dtos/criar-compatibilidade-cpu-placa-mae.dto';
import { CriarCompatibilidadeMemoriaPlacaMaeDto } from './dtos/criar-compatibilidade-memoria-placa-mae.dto';
import { CriarHardwareDto } from './dtos/criar-hardware.dto';
import type { SuporteRadiadorGabinete } from '../generated/prisma/client';
import {
  SentidoFluxoAr,
  VentoinhaMontagemDto,
  VerificarCompatibilidadeMontagemDto,
} from './dtos/verificar-compatibilidade-montagem.dto';
import { CriarModelo3DHardwareDto } from './dtos/modelos-3d/criar-modelo-3d-hardware.dto';
import { AtualizarStatusModelo3DDto } from './dtos/modelos-3d/atualizar-status-modelo-3d.dto';
import { AtualizarModelo3DHardwareDto } from './dtos/modelos-3d/atualizar-modelo-3d-hardware.dto';
import { CriarPontoEncaixeHardwareDto } from './dtos/modelos-3d/criar-ponto-encaixe-hardware.dto';
import { CriarAjusteEncaixeHardwareDto } from './dtos/modelos-3d/criar-ajuste-encaixe-hardware.dto';
import { AtualizarPontoEncaixeHardwareDto } from './dtos/modelos-3d/atualizar-ponto-encaixe-hardware.dto';
import { AtualizarAjusteEncaixeHardwareDto } from './dtos/modelos-3d/atualizar-ajuste-encaixe-hardware.dto';
import { ResolverMontagem3DDto } from './dtos/modelos-3d/resolver-montagem-3d.dto';
import { ResolverMontagemCompletaDto } from './dtos/modelos-3d/resolver-montagem-completa.dto';
import { FiltrarHardwaresDto } from './dtos/filtrar-hardwares.dto';
import { UploadModelo3DHardwareDto } from './dtos/modelos-3d/upload-modelo-3d-hardware.dto';

@Injectable()
export class HardwaresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  private async validarUrlPublicaImportacao(valor: string): Promise<URL> {
    try {
      return (await validarUrlPublica(valor)).url;
    } catch (erro) {
      throw new BadRequestException(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível validar o endereço informado.',
      );
    }
  }

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

  private categoriaParticipaMontagem3D(categoria: CategoriaHardware): boolean {
    return new Set<CategoriaHardware>([
      CategoriaHardware.PROCESSADOR,
      CategoriaHardware.PLACA_MAE,
      CategoriaHardware.MEMORIA_RAM,
      CategoriaHardware.PLACA_VIDEO,
      CategoriaHardware.ARMAZENAMENTO,
      CategoriaHardware.FONTE,
      CategoriaHardware.GABINETE,
      CategoriaHardware.COOLER,
      CategoriaHardware.VENTOINHA,
    ]).has(categoria);
  }

  private validarEspecificacaoDaCategoria(dados: CriarHardwareDto): void {
    const especificacoes = [
      {
        categoria: CategoriaHardware.PROCESSADOR,
        presente: Boolean(dados.especificacaoProcessador),
      },
      {
        categoria: CategoriaHardware.PLACA_MAE,
        presente: Boolean(dados.especificacaoPlacaMae),
      },
      {
        categoria: CategoriaHardware.MEMORIA_RAM,
        presente: Boolean(dados.especificacaoMemoriaRam),
      },
      {
        categoria: CategoriaHardware.GABINETE,
        presente: Boolean(dados.especificacaoGabinete),
      },
      {
        categoria: CategoriaHardware.FONTE,
        presente: Boolean(dados.especificacaoFonte),
      },
      {
        categoria: CategoriaHardware.PLACA_VIDEO,
        presente: Boolean(dados.especificacaoPlacaVideo),
      },
      {
        categoria: CategoriaHardware.COOLER,
        presente: Boolean(dados.especificacaoCooler),
      },
      {
        categoria: CategoriaHardware.VENTOINHA,
        presente: Boolean(dados.especificacaoVentoinha),
      },
      {
        categoria: CategoriaHardware.ARMAZENAMENTO,
        presente: Boolean(dados.especificacaoArmazenamento),
      },
    ];

    const especificacoesInformadas = especificacoes.filter(
      (item) => item.presente,
    );

    if (especificacoesInformadas.length > 1) {
      throw new BadRequestException(
        'Informe somente a especificação correspondente à categoria do hardware.',
      );
    }

    const especificacaoEsperada = especificacoes.find(
      (item) => item.categoria === dados.categoria,
    );

    if (
      especificacoesInformadas.length === 1 &&
      especificacoesInformadas[0].categoria !== dados.categoria
    ) {
      throw new BadRequestException(
        'A especificação informada não corresponde à categoria do hardware.',
      );
    }

    if (
      dados.publicado === true &&
      especificacaoEsperada &&
      !especificacaoEsperada.presente
    ) {
      throw new BadRequestException(
        'Um hardware publicado precisa possuir sua especificação técnica.',
      );
    }
  }

  private validarCoerenciaEspecificacoes(
    dados: CriarHardwareDto | AtualizarHardwareDto,
  ): void {
    const processador = dados.especificacaoProcessador;
    if (
      processador?.possuiVideoIntegrado === false &&
      processador.modeloVideoIntegrado?.trim()
    ) {
      throw new BadRequestException(
        'Um processador sem vídeo integrado não pode informar modelo de GPU integrada.',
      );
    }

    const memoria = dados.especificacaoMemoriaRam;
    if (
      memoria?.frequenciaJedecMhz !== undefined &&
      memoria.frequenciaJedecMhz > memoria.frequenciaMhz
    ) {
      throw new BadRequestException(
        'A frequência JEDEC da memória não pode ser maior que a frequência anunciada.',
      );
    }

    const placaMae = dados.especificacaoPlacaMae;
    if (
      placaMae?.capacidadeMaximaMemoriaGb !== undefined &&
      placaMae.capacidadeMaximaPorSlotGb !== undefined &&
      placaMae.capacidadeMaximaPorSlotGb > placaMae.capacidadeMaximaMemoriaGb
    ) {
      throw new BadRequestException(
        'A capacidade máxima por slot não pode exceder a capacidade total de memória da placa-mãe.',
      );
    }

    const placaVideo = dados.especificacaoPlacaVideo;
    if (
      placaVideo?.clockBaseMhz !== undefined &&
      placaVideo.clockBoostMhz !== undefined &&
      placaVideo.clockBaseMhz > placaVideo.clockBoostMhz
    ) {
      throw new BadRequestException(
        'O clock base da placa de vídeo não pode ser maior que o clock boost.',
      );
    }

    const ventoinha = dados.especificacaoVentoinha;
    if (
      ventoinha?.rpmMinima !== undefined &&
      ventoinha.rpmMaxima !== undefined &&
      ventoinha.rpmMinima > ventoinha.rpmMaxima
    ) {
      throw new BadRequestException(
        'A rotação mínima da ventoinha não pode ser maior que a rotação máxima.',
      );
    }

    const cooler = dados.especificacaoCooler;
    if (cooler?.tipo === TipoCooler.WATER_COOLER && !cooler.tamanhoRadiadorMm) {
      throw new BadRequestException(
        'Um water cooler precisa informar o tamanho do radiador.',
      );
    }

    if (
      cooler?.tipo === TipoCooler.AIR_COOLER &&
      (cooler.tamanhoRadiadorMm !== undefined ||
        cooler.espessuraRadiadorMm !== undefined ||
        cooler.comprimentoMangueirasMm !== undefined)
    ) {
      throw new BadRequestException(
        'Um air cooler não pode informar dados de radiador ou mangueiras.',
      );
    }

    const armazenamento = dados.especificacaoArmazenamento;
    if (armazenamento) {
      const possuiDadosM2 =
        armazenamento.tamanhoM2Mm !== undefined ||
        armazenamento.chaveM2 !== undefined;

      if (armazenamento.formato === FormatoArmazenamento.M2) {
        if (
          armazenamento.tamanhoM2Mm === undefined ||
          armazenamento.chaveM2 === undefined
        ) {
          throw new BadRequestException(
            'Um armazenamento M.2 precisa informar tamanho e chave M.2.',
          );
        }

        if (
          armazenamento.interface !== InterfaceArmazenamento.SATA &&
          armazenamento.interface !== InterfaceArmazenamento.NVME_PCIE
        ) {
          throw new BadRequestException(
            'Um armazenamento M.2 deve usar interface SATA ou NVMe/PCIe.',
          );
        }
      } else if (possuiDadosM2) {
        throw new BadRequestException(
          'Tamanho e chave M.2 só podem ser informados para armazenamento no formato M.2.',
        );
      }

      if (
        armazenamento.formato === FormatoArmazenamento.PLACA_PCIE &&
        armazenamento.interface !== InterfaceArmazenamento.NVME_PCIE
      ) {
        throw new BadRequestException(
          'Armazenamento em placa PCIe deve usar interface NVMe/PCIe.',
        );
      }

      if (
        armazenamento.tipo === 'HDD' &&
        (armazenamento.formato === FormatoArmazenamento.M2 ||
          armazenamento.formato === FormatoArmazenamento.PLACA_PCIE)
      ) {
        throw new BadRequestException(
          'Um HDD não pode usar formato M.2 ou placa PCIe.',
        );
      }
    }
  }

  listarTodos() {
    return this.prisma.hardware.findMany({
      include: {
        especificacaoProcessador: true,
        especificacaoPlacaMae: {
          include: {
            slotsM2: {
              orderBy: {
                id: 'asc',
              },
            },
          },
        },
        especificacaoMemoriaRam: true,
        especificacaoGabinete: {
          include: {
            suportesFans: true,
            suportesRadiador: true,
          },
        },
        especificacaoFonte: true,
        especificacaoPlacaVideo: true,
        especificacaoCooler: true,
        especificacaoVentoinha: true,
        especificacaoArmazenamento: true,
        produto: { include: { categoria: true } },
        modelos3D: true,
        pontosEncaixe: true,
      },
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
      include: {
        especificacaoProcessador: true,
        especificacaoPlacaMae: {
          include: {
            slotsM2: {
              orderBy: {
                id: 'asc',
              },
            },
          },
        },
        especificacaoMemoriaRam: true,
        especificacaoGabinete: {
          include: {
            suportesFans: true,
            suportesRadiador: true,
          },
        },
        especificacaoFonte: true,
        especificacaoPlacaVideo: true,
        especificacaoCooler: true,
        especificacaoVentoinha: true,
        especificacaoArmazenamento: true,
        produto: { include: { categoria: true } },
        modelos3D: true,
        pontosEncaixe: true,
      },
    });

    if (!hardware) {
      throw new NotFoundException('Hardware não encontrado.');
    }

    return hardware;
  }
  listarPublicados(filtros: FiltrarHardwaresDto = {}) {
    return this.prisma.hardware.findMany({
      where: {
        ativo: true,
        publicado: true,
        ...(filtros.categoria !== undefined && {
          categoria: filtros.categoria,
        }),
        ...(filtros.marca && {
          marca: { equals: filtros.marca, mode: 'insensitive' },
        }),
        ...(filtros.busca && {
          OR: [
            { nome: { contains: filtros.busca, mode: 'insensitive' } },
            { marca: { contains: filtros.busca, mode: 'insensitive' } },
            { modelo: { contains: filtros.busca, mode: 'insensitive' } },
            { descricao: { contains: filtros.busca, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        especificacaoProcessador: true,
        especificacaoPlacaMae: {
          include: {
            slotsM2: {
              orderBy: {
                id: 'asc',
              },
            },
          },
        },
        especificacaoMemoriaRam: true,
        especificacaoGabinete: {
          include: {
            suportesFans: true,
            suportesRadiador: true,
          },
        },
        especificacaoFonte: true,
        especificacaoPlacaVideo: true,
        especificacaoCooler: true,
        especificacaoVentoinha: true,
        especificacaoArmazenamento: true,
        produto: {
          select: {
            id: true,
            slug: true,
            mpn: true,
            gtin: true,
            imagemHoverUrl: true,
            categoria: true,
            ofertas: {
              where: {
                status: StatusOferta.ATIVA,
                parceiro: { ativo: true },
                OR: [{ validoAte: null }, { validoAte: { gte: new Date() } }],
              },
              orderBy: { preco: 'asc' },
              take: 1,
              include: {
                parceiro: {
                  select: { id: true, nome: true, slug: true, logoUrl: true },
                },
              },
            },
          },
        },
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
      include: {
        especificacaoProcessador: true,
        especificacaoPlacaMae: {
          include: {
            slotsM2: {
              orderBy: {
                id: 'asc',
              },
            },
          },
        },
        especificacaoMemoriaRam: true,
        especificacaoGabinete: {
          include: {
            suportesFans: true,
            suportesRadiador: true,
          },
        },
        especificacaoFonte: true,
        especificacaoPlacaVideo: true,
        especificacaoCooler: true,
        especificacaoVentoinha: true,
        especificacaoArmazenamento: true,
        modelos3D: {
          where: { ativo: true, aprovado: true },
          orderBy: [{ atualizadoEm: 'desc' }, { id: 'desc' }],
          take: 1,
        },
        produto: {
          include: {
            categoria: true,
            ofertas: {
              where: {
                status: StatusOferta.ATIVA,
                parceiro: { ativo: true },
                OR: [{ validoAte: null }, { validoAte: { gte: new Date() } }],
              },
              orderBy: { preco: 'asc' },
              include: {
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
            },
          },
        },
      },
    });

    if (!hardware) {
      throw new NotFoundException('Hardware não encontrado.');
    }

    const avaliacao = hardware.produtoId
      ? await this.prisma.avaliacao.aggregate({
          where: {
            produtoId: hardware.produtoId,
            status: StatusAvaliacao.PUBLICADA,
          },
          _avg: { nota: true },
          _count: { _all: true },
        })
      : null;

    const especificacoesTecnicas =
      hardware.especificacaoProcessador ??
      hardware.especificacaoPlacaMae ??
      hardware.especificacaoMemoriaRam ??
      hardware.especificacaoPlacaVideo ??
      hardware.especificacaoArmazenamento ??
      hardware.especificacaoFonte ??
      hardware.especificacaoGabinete ??
      hardware.especificacaoCooler ??
      hardware.especificacaoVentoinha ??
      hardware.especificacoes;

    return {
      ...hardware,
      mpn: hardware.mpn ?? hardware.produto?.mpn ?? null,
      gtin: hardware.gtin ?? hardware.produto?.gtin ?? null,
      imagemHoverUrl:
        hardware.imagemHoverUrl ?? hardware.produto?.imagemHoverUrl ?? null,
      especificacoes: normalizarEspecificacoesHardwarePublicas(
        hardware.categoria,
        especificacoesTecnicas,
      ),
      possuiModelo3D: hardware.modelos3D.length > 0,
      ofertas: hardware.produto?.ofertas ?? [],
      avaliacao: {
        media: avaliacao?._avg.nota ?? 0,
        quantidade: avaliacao?._count._all ?? 0,
      },
    };
  }

  async criar(dados: CriarHardwareDto) {
    if (!this.categoriaParticipaMontagem3D(dados.categoria)) {
      throw new BadRequestException(
        `A categoria ${dados.categoria} agora pertence ao catálogo geral da Loja. Cadastre-a pela rota de produtos, não como Hardware técnico.`,
      );
    }

    this.validarEspecificacaoDaCategoria(dados);
    this.validarCoerenciaEspecificacoes(dados);

    const nome = dados.nome.trim();
    const marca = dados.marca.trim();
    const modelo = dados.modelo.trim();

    const duplicadoHardware = await this.prisma.hardware.findFirst({
      where: {
        OR: [
          ...(dados.mpn?.trim() ? [{ mpn: dados.mpn.trim() }] : []),
          ...(dados.gtin?.trim() ? [{ gtin: dados.gtin.trim() }] : []),
          {
            marca: { equals: marca, mode: 'insensitive' },
            modelo: { equals: modelo, mode: 'insensitive' },
          },
        ],
      },
      select: { id: true, nome: true },
    });

    if (duplicadoHardware) {
      throw new ConflictException(
        `Possível hardware duplicado: ID ${duplicadoHardware.id} — ${duplicadoHardware.nome}. Revise MPN/GTIN/marca/modelo antes de cadastrar outro registro técnico.`,
      );
    }

    const slug = await this.criarSlugUnico(`${marca} ${modelo} ${nome}`);

    const dadosGabinete = dados.especificacaoGabinete
      ? (() => {
          const { suportesFans, suportesRadiador, ...gabinete } =
            dados.especificacaoGabinete;

          return {
            ...gabinete,
            suportesFans: suportesFans
              ? {
                  create: suportesFans,
                }
              : undefined,
            suportesRadiador: suportesRadiador
              ? {
                  create: suportesRadiador,
                }
              : undefined,
          };
        })()
      : undefined;

    try {
      return await this.prisma.hardware.create({
        data: {
          nome,
          slug,
          categoria: dados.categoria,
          marca,
          modelo,
          descricao: dados.descricao?.trim(),
          mpn: dados.mpn?.trim() || null,
          gtin: dados.gtin?.trim() || null,
          imagemUrl: dados.imagemUrl?.trim(),
          imagemHoverUrl: dados.imagemHoverUrl?.trim() || null,
          especificacoes: dados.especificacoes as
            Prisma.InputJsonValue | undefined,
          publicado: dados.publicado ?? false,
          ativo: dados.ativo ?? true,

          especificacaoProcessador: dados.especificacaoProcessador
            ? {
                create: dados.especificacaoProcessador,
              }
            : undefined,

          especificacaoPlacaMae: dados.especificacaoPlacaMae
            ? {
                create: (() => {
                  const { slotsM2, ...camposPlacaMae } =
                    dados.especificacaoPlacaMae;

                  return {
                    ...camposPlacaMae,
                    slotsM2:
                      slotsM2 !== undefined
                        ? {
                            create: slotsM2,
                          }
                        : undefined,
                  };
                })(),
              }
            : undefined,

          especificacaoMemoriaRam: dados.especificacaoMemoriaRam
            ? {
                create: dados.especificacaoMemoriaRam,
              }
            : undefined,

          especificacaoGabinete: dadosGabinete
            ? {
                create: dadosGabinete,
              }
            : undefined,

          especificacaoFonte: dados.especificacaoFonte
            ? {
                create: dados.especificacaoFonte,
              }
            : undefined,

          especificacaoPlacaVideo: dados.especificacaoPlacaVideo
            ? {
                create: dados.especificacaoPlacaVideo,
              }
            : undefined,

          especificacaoCooler: dados.especificacaoCooler
            ? {
                create: dados.especificacaoCooler,
              }
            : undefined,

          especificacaoVentoinha: dados.especificacaoVentoinha
            ? {
                create: dados.especificacaoVentoinha,
              }
            : undefined,

          especificacaoArmazenamento: dados.especificacaoArmazenamento
            ? {
                create: dados.especificacaoArmazenamento,
              }
            : undefined,
        },
        include: {
          especificacaoProcessador: true,
          especificacaoPlacaMae: {
            include: {
              slotsM2: {
                orderBy: {
                  id: 'asc',
                },
              },
            },
          },
          especificacaoMemoriaRam: true,
          especificacaoGabinete: {
            include: {
              suportesFans: true,
              suportesRadiador: true,
            },
          },
          especificacaoFonte: true,
          especificacaoPlacaVideo: true,
          especificacaoCooler: true,
          especificacaoVentoinha: true,
          especificacaoArmazenamento: true,
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

    if (
      dados.categoria !== undefined &&
      dados.categoria !== hardwareAtual.categoria
    ) {
      throw new BadRequestException(
        'A categoria do hardware não pode ser alterada após o cadastro.',
      );
    }

    this.validarCoerenciaEspecificacoes(dados);

    const especificacoesInformadas = [
      {
        categoria: CategoriaHardware.PROCESSADOR,
        presente: Boolean(dados.especificacaoProcessador),
      },
      {
        categoria: CategoriaHardware.PLACA_MAE,
        presente: Boolean(dados.especificacaoPlacaMae),
      },
      {
        categoria: CategoriaHardware.MEMORIA_RAM,
        presente: Boolean(dados.especificacaoMemoriaRam),
      },
      {
        categoria: CategoriaHardware.GABINETE,
        presente: Boolean(dados.especificacaoGabinete),
      },
      {
        categoria: CategoriaHardware.FONTE,
        presente: Boolean(dados.especificacaoFonte),
      },
      {
        categoria: CategoriaHardware.PLACA_VIDEO,
        presente: Boolean(dados.especificacaoPlacaVideo),
      },
      {
        categoria: CategoriaHardware.COOLER,
        presente: Boolean(dados.especificacaoCooler),
      },
      {
        categoria: CategoriaHardware.VENTOINHA,
        presente: Boolean(dados.especificacaoVentoinha),
      },
      {
        categoria: CategoriaHardware.ARMAZENAMENTO,
        presente: Boolean(dados.especificacaoArmazenamento),
      },
    ].filter((item) => item.presente);

    if (especificacoesInformadas.length > 1) {
      throw new BadRequestException(
        'Informe somente uma especificação técnica por hardware.',
      );
    }

    if (
      especificacoesInformadas.length === 1 &&
      especificacoesInformadas[0].categoria !== hardwareAtual.categoria
    ) {
      throw new BadRequestException(
        'A especificação informada não corresponde à categoria do hardware.',
      );
    }

    const possuiEspecificacaoAtual =
      hardwareAtual.especificacaoProcessador !== null ||
      hardwareAtual.especificacaoPlacaMae !== null ||
      hardwareAtual.especificacaoMemoriaRam !== null ||
      hardwareAtual.especificacaoGabinete !== null ||
      hardwareAtual.especificacaoFonte !== null ||
      hardwareAtual.especificacaoPlacaVideo !== null ||
      hardwareAtual.especificacaoCooler !== null ||
      hardwareAtual.especificacaoVentoinha !== null ||
      hardwareAtual.especificacaoArmazenamento !== null;

    const ficaráPublicado = dados.publicado ?? hardwareAtual.publicado;

    if (
      ficaráPublicado &&
      !possuiEspecificacaoAtual &&
      especificacoesInformadas.length === 0
    ) {
      throw new BadRequestException(
        'Um hardware publicado precisa possuir sua especificação técnica.',
      );
    }

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

    const dadosGabinete = dados.especificacaoGabinete
      ? (() => {
          const { suportesFans, suportesRadiador, ...gabinete } =
            dados.especificacaoGabinete;

          return {
            create: {
              ...gabinete,
              suportesFans: suportesFans
                ? {
                    create: suportesFans,
                  }
                : undefined,
              suportesRadiador: suportesRadiador
                ? {
                    create: suportesRadiador,
                  }
                : undefined,
            },
            update: {
              ...gabinete,
              suportesFans: suportesFans
                ? {
                    deleteMany: {},
                    create: suportesFans,
                  }
                : undefined,
              suportesRadiador: suportesRadiador
                ? {
                    deleteMany: {},
                    create: suportesRadiador,
                  }
                : undefined,
            },
          };
        })()
      : undefined;

    try {
      return await this.prisma.hardware.update({
        where: {
          id,
        },
        data: {
          nome,
          slug,
          marca,
          modelo,
          descricao:
            dados.descricao === undefined ? undefined : dados.descricao.trim(),
          imagemUrl:
            dados.imagemUrl === undefined ? undefined : dados.imagemUrl.trim(),
          especificacoes:
            dados.especificacoes === undefined
              ? undefined
              : (dados.especificacoes as Prisma.InputJsonValue),
          publicado: dados.publicado,
          ativo: dados.ativo,
          mpn: dados.mpn === undefined ? undefined : dados.mpn.trim() || null,
          gtin:
            dados.gtin === undefined ? undefined : dados.gtin.trim() || null,
          imagemHoverUrl:
            dados.imagemHoverUrl === undefined
              ? undefined
              : dados.imagemHoverUrl.trim() || null,

          especificacaoProcessador: dados.especificacaoProcessador
            ? {
                upsert: {
                  create: dados.especificacaoProcessador,
                  update: dados.especificacaoProcessador,
                },
              }
            : undefined,

          especificacaoPlacaMae: dados.especificacaoPlacaMae
            ? {
                upsert: {
                  create: (() => {
                    const { slotsM2, ...camposPlacaMae } =
                      dados.especificacaoPlacaMae;

                    return {
                      ...camposPlacaMae,
                      slotsM2:
                        slotsM2 !== undefined
                          ? {
                              create: slotsM2,
                            }
                          : undefined,
                    };
                  })(),

                  update: (() => {
                    const { slotsM2, ...camposPlacaMae } =
                      dados.especificacaoPlacaMae;

                    return {
                      ...camposPlacaMae,
                      slotsM2:
                        slotsM2 !== undefined
                          ? {
                              deleteMany: {},
                              create: slotsM2,
                            }
                          : undefined,
                    };
                  })(),
                },
              }
            : undefined,

          especificacaoMemoriaRam: dados.especificacaoMemoriaRam
            ? {
                upsert: {
                  create: dados.especificacaoMemoriaRam,
                  update: dados.especificacaoMemoriaRam,
                },
              }
            : undefined,

          especificacaoGabinete: dadosGabinete
            ? {
                upsert: dadosGabinete,
              }
            : undefined,

          especificacaoFonte: dados.especificacaoFonte
            ? {
                upsert: {
                  create: dados.especificacaoFonte,
                  update: dados.especificacaoFonte,
                },
              }
            : undefined,

          especificacaoPlacaVideo: dados.especificacaoPlacaVideo
            ? {
                upsert: {
                  create: dados.especificacaoPlacaVideo,
                  update: dados.especificacaoPlacaVideo,
                },
              }
            : undefined,

          especificacaoCooler: dados.especificacaoCooler
            ? {
                upsert: {
                  create: dados.especificacaoCooler,
                  update: dados.especificacaoCooler,
                },
              }
            : undefined,

          especificacaoVentoinha: dados.especificacaoVentoinha
            ? {
                upsert: {
                  create: dados.especificacaoVentoinha,
                  update: dados.especificacaoVentoinha,
                },
              }
            : undefined,

          especificacaoArmazenamento: dados.especificacaoArmazenamento
            ? {
                upsert: {
                  create: dados.especificacaoArmazenamento,
                  update: dados.especificacaoArmazenamento,
                },
              }
            : undefined,
        },
        include: {
          especificacaoProcessador: true,
          especificacaoPlacaMae: {
            include: {
              slotsM2: {
                orderBy: {
                  id: 'asc',
                },
              },
            },
          },
          especificacaoMemoriaRam: true,
          especificacaoGabinete: {
            include: {
              suportesFans: true,
              suportesRadiador: true,
            },
          },
          especificacaoFonte: true,
          especificacaoPlacaVideo: true,
          especificacaoCooler: true,
          especificacaoVentoinha: true,
          especificacaoArmazenamento: true,
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
      where: { id },
      data: { ativo: false, publicado: false },
    });

    return {
      mensagem:
        'Hardware removido com sucesso. Produtos e Ofertas vinculados não foram alterados.',
    };
  }

  async removerPermanentemente(id: number) {
    await this.buscarPorIdAdmin(id);

    try {
      await this.prisma.hardware.delete({ where: { id } });

      return {
        mensagem:
          'Hardware excluído permanentemente. Produtos vinculados foram preservados e perderam apenas o vínculo técnico.',
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

  async criarCompatibilidadeCpuPlacaMae(
    dados: CriarCompatibilidadeCpuPlacaMaeDto,
  ) {
    const [placaMae, processador] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: {
          id: dados.placaMaeId,
        },
        include: {
          especificacaoPlacaMae: true,
        },
      }),
      this.prisma.hardware.findUnique({
        where: {
          id: dados.processadorId,
        },
        include: {
          especificacaoProcessador: true,
        },
      }),
    ]);

    if (!placaMae) {
      throw new NotFoundException('Placa-mãe não encontrada.');
    }

    if (!processador) {
      throw new NotFoundException('Processador não encontrado.');
    }

    if (placaMae.categoria !== CategoriaHardware.PLACA_MAE) {
      throw new BadRequestException(
        'O hardware informado como placa-mãe não pertence à categoria PLACA_MAE.',
      );
    }

    if (processador.categoria !== CategoriaHardware.PROCESSADOR) {
      throw new BadRequestException(
        'O hardware informado como processador não pertence à categoria PROCESSADOR.',
      );
    }

    if (!placaMae.especificacaoPlacaMae) {
      throw new BadRequestException(
        'A placa-mãe não possui especificação técnica cadastrada.',
      );
    }

    if (!processador.especificacaoProcessador) {
      throw new BadRequestException(
        'O processador não possui especificação técnica cadastrada.',
      );
    }

    const compativel = dados.compativel ?? true;

    if (
      compativel &&
      placaMae.especificacaoPlacaMae.socket !==
        processador.especificacaoProcessador.socket
    ) {
      throw new BadRequestException(
        'Não é possível marcar como compatíveis componentes com sockets diferentes.',
      );
    }

    const compatibilidadeExistente =
      await this.prisma.compatibilidadeCpuPlacaMae.findFirst({
        where: {
          placaMaeId: dados.placaMaeId,
          processadorId: dados.processadorId,
          revisaoPlacaMae: dados.revisaoPlacaMae?.trim() ?? null,
        },
        select: {
          id: true,
        },
      });

    if (compatibilidadeExistente) {
      throw new ConflictException(
        'Esta compatibilidade entre CPU e placa-mãe já foi cadastrada.',
      );
    }

    return this.prisma.compatibilidadeCpuPlacaMae.create({
      data: {
        placaMaeId: dados.placaMaeId,
        processadorId: dados.processadorId,
        revisaoPlacaMae: dados.revisaoPlacaMae?.trim(),
        biosMinima: dados.biosMinima?.trim(),
        compativel,
        observacao: dados.observacao?.trim(),
        fonteUrl: dados.fonteUrl?.trim(),
        verificadoEm: dados.verificadoEm
          ? new Date(dados.verificadoEm)
          : undefined,
      },
      include: {
        placaMae: {
          select: {
            id: true,
            nome: true,
            marca: true,
            modelo: true,
          },
        },
        processador: {
          select: {
            id: true,
            nome: true,
            marca: true,
            modelo: true,
          },
        },
      },
    });
  }

  listarCompatibilidadesCpuPlacaMae() {
    return this.prisma.compatibilidadeCpuPlacaMae.findMany({
      include: {
        placaMae: {
          select: {
            id: true,
            nome: true,
            marca: true,
            modelo: true,
          },
        },
        processador: {
          select: {
            id: true,
            nome: true,
            marca: true,
            modelo: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async verificarCompatibilidadeCpuPlacaMae(
    placaMaeId: number,
    processadorId: number,
  ) {
    const [placaMae, processador] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: {
          id: placaMaeId,
        },
        include: {
          especificacaoPlacaMae: true,
        },
      }),
      this.prisma.hardware.findUnique({
        where: {
          id: processadorId,
        },
        include: {
          especificacaoProcessador: true,
        },
      }),
    ]);

    if (!placaMae) {
      throw new NotFoundException('Placa-mãe não encontrada.');
    }

    if (!processador) {
      throw new NotFoundException('Processador não encontrado.');
    }

    if (placaMae.categoria !== CategoriaHardware.PLACA_MAE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria PLACA_MAE.',
      );
    }

    if (processador.categoria !== CategoriaHardware.PROCESSADOR) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria PROCESSADOR.',
      );
    }

    if (!placaMae.especificacaoPlacaMae) {
      throw new BadRequestException(
        'A placa-mãe não possui especificação técnica cadastrada.',
      );
    }

    if (!processador.especificacaoProcessador) {
      throw new BadRequestException(
        'O processador não possui especificação técnica cadastrada.',
      );
    }

    const socketPlacaMae = placaMae.especificacaoPlacaMae.socket;
    const socketProcessador = processador.especificacaoProcessador.socket;

    if (socketPlacaMae !== socketProcessador) {
      return {
        compativel: false,
        status: 'INCOMPATIVEL',
        motivo: 'A placa-mãe e o processador possuem sockets diferentes.',
        placaMae: {
          id: placaMae.id,
          nome: placaMae.nome,
          socket: socketPlacaMae,
        },
        processador: {
          id: processador.id,
          nome: processador.nome,
          socket: socketProcessador,
        },
      };
    }

    const compatibilidade =
      await this.prisma.compatibilidadeCpuPlacaMae.findFirst({
        where: {
          placaMaeId,
          processadorId,
        },
        orderBy: {
          atualizadoEm: 'desc',
        },
      });

    if (!compatibilidade) {
      return {
        compativel: null,
        status: 'NAO_CONFIRMADO',
        motivo:
          'Os sockets são iguais, mas o processador ainda não consta na lista de compatibilidade cadastrada para esta placa-mãe.',
        placaMae: {
          id: placaMae.id,
          nome: placaMae.nome,
          socket: socketPlacaMae,
        },
        processador: {
          id: processador.id,
          nome: processador.nome,
          socket: socketProcessador,
        },
      };
    }

    return {
      compativel: compatibilidade.compativel,
      status: compatibilidade.compativel ? 'COMPATIVEL' : 'INCOMPATIVEL',
      biosMinima: compatibilidade.biosMinima,
      revisaoPlacaMae: compatibilidade.revisaoPlacaMae,
      observacao: compatibilidade.observacao,
      fonteUrl: compatibilidade.fonteUrl,
      verificadoEm: compatibilidade.verificadoEm,
      placaMae: {
        id: placaMae.id,
        nome: placaMae.nome,
        socket: socketPlacaMae,
      },
      processador: {
        id: processador.id,
        nome: processador.nome,
        socket: socketProcessador,
      },
    };
  }

  async criarCompatibilidadeMemoriaPlacaMae(
    dados: CriarCompatibilidadeMemoriaPlacaMaeDto,
  ) {
    const [placaMae, memoriaRam] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: {
          id: dados.placaMaeId,
        },
        include: {
          especificacaoPlacaMae: true,
        },
      }),
      this.prisma.hardware.findUnique({
        where: {
          id: dados.memoriaRamId,
        },
        include: {
          especificacaoMemoriaRam: true,
        },
      }),
    ]);

    if (!placaMae) {
      throw new NotFoundException('Placa-mãe não encontrada.');
    }

    if (!memoriaRam) {
      throw new NotFoundException('Memória RAM não encontrada.');
    }

    if (placaMae.categoria !== CategoriaHardware.PLACA_MAE) {
      throw new BadRequestException(
        'O hardware informado como placa-mãe não pertence à categoria PLACA_MAE.',
      );
    }

    if (memoriaRam.categoria !== CategoriaHardware.MEMORIA_RAM) {
      throw new BadRequestException(
        'O hardware informado como memória não pertence à categoria MEMORIA_RAM.',
      );
    }

    if (!placaMae.especificacaoPlacaMae) {
      throw new BadRequestException(
        'A placa-mãe não possui especificação técnica cadastrada.',
      );
    }

    if (!memoriaRam.especificacaoMemoriaRam) {
      throw new BadRequestException(
        'A memória RAM não possui especificação técnica cadastrada.',
      );
    }

    const especificacaoPlacaMae = placaMae.especificacaoPlacaMae;
    const especificacaoMemoria = memoriaRam.especificacaoMemoriaRam;
    const compativel = dados.compativel ?? true;

    if (
      compativel &&
      !especificacaoPlacaMae.tiposMemoriaSuportados.includes(
        especificacaoMemoria.tipo,
      )
    ) {
      throw new BadRequestException(
        'A placa-mãe não suporta o tipo DDR desta memória.',
      );
    }

    const quantidadeModulos =
      dados.quantidadeModulosTestados ?? especificacaoMemoria.quantidadeModulos;

    if (compativel && quantidadeModulos > especificacaoPlacaMae.slotsMemoria) {
      throw new BadRequestException(
        'A quantidade de módulos excede os slots disponíveis na placa-mãe.',
      );
    }

    if (
      compativel &&
      especificacaoPlacaMae.capacidadeMaximaPorSlotGb !== null &&
      especificacaoMemoria.capacidadePorModuloGb >
        especificacaoPlacaMae.capacidadeMaximaPorSlotGb
    ) {
      throw new BadRequestException(
        'A capacidade por módulo excede o limite do slot da placa-mãe.',
      );
    }

    const capacidadeTotal =
      dados.capacidadeTotalTestadaGb ??
      especificacaoMemoria.capacidadePorModuloGb * quantidadeModulos;

    if (
      compativel &&
      especificacaoPlacaMae.capacidadeMaximaMemoriaGb !== null &&
      capacidadeTotal > especificacaoPlacaMae.capacidadeMaximaMemoriaGb
    ) {
      throw new BadRequestException(
        'A capacidade total da memória excede o limite da placa-mãe.',
      );
    }

    const frequenciasSuportadas = [
      ...especificacaoPlacaMae.frequenciasMemoriaJedecMhz,
      ...especificacaoPlacaMae.frequenciasMemoriaOverclockMhz,
    ];

    if (
      compativel &&
      dados.frequenciaValidadaMhz !== undefined &&
      frequenciasSuportadas.length > 0 &&
      dados.frequenciaValidadaMhz > Math.max(...frequenciasSuportadas)
    ) {
      throw new BadRequestException(
        'A frequência validada excede o limite informado pela placa-mãe.',
      );
    }

    const compatibilidadeExistente =
      await this.prisma.compatibilidadeMemoriaPlacaMae.findFirst({
        where: {
          placaMaeId: dados.placaMaeId,
          memoriaRamId: dados.memoriaRamId,
          revisaoPlacaMae: dados.revisaoPlacaMae?.trim() ?? null,
        },
        select: {
          id: true,
        },
      });

    if (compatibilidadeExistente) {
      throw new ConflictException(
        'Esta compatibilidade entre memória e placa-mãe já foi cadastrada.',
      );
    }

    return this.prisma.compatibilidadeMemoriaPlacaMae.create({
      data: {
        placaMaeId: dados.placaMaeId,
        memoriaRamId: dados.memoriaRamId,
        revisaoPlacaMae: dados.revisaoPlacaMae?.trim(),
        biosTestada: dados.biosTestada?.trim(),
        familiaProcessadorTestada: dados.familiaProcessadorTestada?.trim(),
        frequenciaValidadaMhz: dados.frequenciaValidadaMhz,
        quantidadeModulosTestados: quantidadeModulos,
        capacidadeTotalTestadaGb: capacidadeTotal,
        compativel,
        constaNaQvl: dados.constaNaQvl ?? true,
        observacao: dados.observacao?.trim(),
        fonteUrl: dados.fonteUrl?.trim(),
        verificadoEm: dados.verificadoEm
          ? new Date(dados.verificadoEm)
          : undefined,
      },
      include: {
        placaMae: {
          select: {
            id: true,
            nome: true,
            marca: true,
            modelo: true,
          },
        },
        memoriaRam: {
          select: {
            id: true,
            nome: true,
            marca: true,
            modelo: true,
          },
        },
      },
    });
  }
  listarCompatibilidadesMemoriaPlacaMae() {
    return this.prisma.compatibilidadeMemoriaPlacaMae.findMany({
      include: {
        placaMae: {
          select: {
            id: true,
            nome: true,
            marca: true,
            modelo: true,
          },
        },
        memoriaRam: {
          select: {
            id: true,
            nome: true,
            marca: true,
            modelo: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
  }
  async verificarCompatibilidadeMemoriaPlacaMae(
    placaMaeId: number,
    memoriaRamId: number,
    quantidadeModulosOverride?: number,
  ) {
    const [placaMae, memoriaRam] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: placaMaeId },
        include: { especificacaoPlacaMae: true },
      }),
      this.prisma.hardware.findUnique({
        where: { id: memoriaRamId },
        include: { especificacaoMemoriaRam: true },
      }),
    ]);

    if (!placaMae) {
      throw new NotFoundException('Placa-mãe não encontrada.');
    }

    if (!memoriaRam) {
      throw new NotFoundException('Memória RAM não encontrada.');
    }

    if (placaMae.categoria !== CategoriaHardware.PLACA_MAE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria PLACA_MAE.',
      );
    }

    if (memoriaRam.categoria !== CategoriaHardware.MEMORIA_RAM) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria MEMORIA_RAM.',
      );
    }

    const especificacaoPlacaMae = placaMae.especificacaoPlacaMae;
    const especificacaoMemoria = memoriaRam.especificacaoMemoriaRam;

    if (!especificacaoPlacaMae) {
      throw new BadRequestException(
        'A placa-mãe não possui especificação técnica cadastrada.',
      );
    }

    if (!especificacaoMemoria) {
      throw new BadRequestException(
        'A memória RAM não possui especificação técnica cadastrada.',
      );
    }

    if (
      !especificacaoPlacaMae.tiposMemoriaSuportados.includes(
        especificacaoMemoria.tipo,
      )
    ) {
      return {
        compativel: false,
        status: 'INCOMPATIVEL',
        motivo: 'O tipo DDR da memória não é suportado pela placa-mãe.',
      };
    }

    if (
      !especificacaoPlacaMae.formatosMemoriaSuportados.includes(
        especificacaoMemoria.formato,
      )
    ) {
      return {
        compativel: false,
        status: 'INCOMPATIVEL',
        motivo: 'O formato físico da memória não é suportado pela placa-mãe.',
      };
    }

    if (especificacaoMemoria.ecc && !especificacaoPlacaMae.suportaEcc) {
      return {
        compativel: false,
        status: 'INCOMPATIVEL',
        motivo:
          'A memória utiliza ECC, mas a placa-mãe não informa suporte a ECC.',
      };
    }

    if (
      especificacaoMemoria.registrada &&
      !especificacaoPlacaMae.suportaMemoriaRegistrada
    ) {
      return {
        compativel: false,
        status: 'INCOMPATIVEL',
        motivo:
          'A memória é registrada (RDIMM), mas a placa-mãe não informa suporte a memória registrada.',
      };
    }

    const quantidadeModulos =
      quantidadeModulosOverride ?? especificacaoMemoria.quantidadeModulos;

    if (quantidadeModulos > especificacaoPlacaMae.slotsMemoria) {
      return {
        compativel: false,
        status: 'INCOMPATIVEL',
        motivo: 'A quantidade de módulos excede os slots da placa-mãe.',
      };
    }

    if (
      especificacaoPlacaMae.capacidadeMaximaPorSlotGb !== null &&
      especificacaoMemoria.capacidadePorModuloGb >
        especificacaoPlacaMae.capacidadeMaximaPorSlotGb
    ) {
      return {
        compativel: false,
        status: 'INCOMPATIVEL',
        motivo: 'A capacidade de cada módulo excede o limite por slot.',
      };
    }

    const capacidadeTotal =
      especificacaoMemoria.capacidadePorModuloGb * quantidadeModulos;

    if (
      especificacaoPlacaMae.capacidadeMaximaMemoriaGb !== null &&
      capacidadeTotal > especificacaoPlacaMae.capacidadeMaximaMemoriaGb
    ) {
      return {
        compativel: false,
        status: 'INCOMPATIVEL',
        motivo: 'A capacidade total excede o limite da placa-mãe.',
      };
    }

    const qvl = await this.prisma.compatibilidadeMemoriaPlacaMae.findFirst({
      where: {
        placaMaeId,
        memoriaRamId,
      },
      orderBy: {
        atualizadoEm: 'desc',
      },
    });

    const frequenciasSuportadas = [
      ...especificacaoPlacaMae.frequenciasMemoriaJedecMhz,
      ...especificacaoPlacaMae.frequenciasMemoriaOverclockMhz,
    ];

    const frequenciaMaximaPlacaMae =
      frequenciasSuportadas.length > 0
        ? Math.max(...frequenciasSuportadas)
        : null;

    if (!qvl) {
      return {
        compativel: true,
        status: 'COMPATIVEL_NAO_CONFIRMADO',
        constaNaQvl: false,
        motivo:
          'A memória é compatível pelas especificações, mas não consta na QVL cadastrada.',
        frequenciaMemoriaMhz: especificacaoMemoria.frequenciaMhz,
        frequenciaMaximaPlacaMaeMhz: frequenciaMaximaPlacaMae,
        observacao:
          'A frequência final também depende do processador e da configuração dos módulos.',
      };
    }

    return {
      compativel: qvl.compativel,
      status: qvl.compativel ? 'COMPATIVEL' : 'INCOMPATIVEL',
      constaNaQvl: qvl.constaNaQvl,
      biosTestada: qvl.biosTestada,
      frequenciaValidadaMhz: qvl.frequenciaValidadaMhz,
      quantidadeModulosTestados: qvl.quantidadeModulosTestados,
      capacidadeTotalTestadaGb: qvl.capacidadeTotalTestadaGb,
      observacao: qvl.observacao,
      fonteUrl: qvl.fonteUrl,
    };
  }
  async verificarCompatibilidadeConjuntoPrincipal(
    placaMaeId: number,
    processadorId: number,
    memoriaRamId: number,
    quantidadeModulosRam?: number,
  ) {
    const [resultadoCpu, resultadoMemoria, processador, placaMae, memoriaRam] =
      await Promise.all([
        this.verificarCompatibilidadeCpuPlacaMae(placaMaeId, processadorId),
        this.verificarCompatibilidadeMemoriaPlacaMae(
          placaMaeId,
          memoriaRamId,
          quantidadeModulosRam,
        ),
        this.prisma.hardware.findUnique({
          where: { id: processadorId },
          include: { especificacaoProcessador: true },
        }),
        this.prisma.hardware.findUnique({
          where: { id: placaMaeId },
          include: { especificacaoPlacaMae: true },
        }),
        this.prisma.hardware.findUnique({
          where: { id: memoriaRamId },
          include: { especificacaoMemoriaRam: true },
        }),
      ]);

    if (
      !processador?.especificacaoProcessador ||
      !placaMae?.especificacaoPlacaMae ||
      !memoriaRam?.especificacaoMemoriaRam
    ) {
      throw new BadRequestException(
        'Um ou mais componentes não possuem especificação técnica.',
      );
    }

    const cpu = processador.especificacaoProcessador;
    const placa = placaMae.especificacaoPlacaMae;
    const memoria = memoriaRam.especificacaoMemoriaRam;

    const erros: string[] = [];
    const alertas: string[] = [];

    if (resultadoCpu.compativel === false) {
      erros.push('O processador não é compatível com a placa-mãe.');
    }

    if (resultadoMemoria.compativel === false) {
      erros.push('A memória RAM não é compatível com a placa-mãe.');
    }

    if (!cpu.tiposMemoriaSuportados.includes(memoria.tipo)) {
      erros.push('O processador não suporta o tipo DDR da memória.');
    }

    if (memoria.ecc && !cpu.suportaEcc) {
      erros.push(
        'A memória utiliza ECC, mas o processador não informa suporte a ECC.',
      );
    }

    const quantidadeModulos = quantidadeModulosRam ?? memoria.quantidadeModulos;
    const capacidadeTotal = memoria.capacidadePorModuloGb * quantidadeModulos;

    if (
      cpu.capacidadeMemoriaMaximaGb !== null &&
      capacidadeTotal > cpu.capacidadeMemoriaMaximaGb
    ) {
      erros.push(
        'A capacidade total da memória excede o limite do processador.',
      );
    }

    const frequenciasPlacaMae = [
      ...placa.frequenciasMemoriaJedecMhz,
      ...placa.frequenciasMemoriaOverclockMhz,
    ];

    const frequenciaMaximaPlacaMae =
      frequenciasPlacaMae.length > 0
        ? Math.max(...frequenciasPlacaMae)
        : memoria.frequenciaMhz;

    const limitesFrequencia = [memoria.frequenciaMhz, frequenciaMaximaPlacaMae];

    if (cpu.frequenciaMemoriaMaximaMhz !== null) {
      limitesFrequencia.push(cpu.frequenciaMemoriaMaximaMhz);
    }

    const frequenciaFinalMhz = Math.min(...limitesFrequencia);

    if (frequenciaFinalMhz < memoria.frequenciaMhz) {
      alertas.push(
        `A memória de ${memoria.frequenciaMhz} MHz poderá operar em até ${frequenciaFinalMhz} MHz.`,
      );
    }

    const frequenciaJedecMaximaPlacaMae =
      placa.frequenciasMemoriaJedecMhz.length > 0
        ? Math.max(...placa.frequenciasMemoriaJedecMhz)
        : null;

    if (
      frequenciaJedecMaximaPlacaMae !== null &&
      memoria.frequenciaMhz > frequenciaJedecMaximaPlacaMae
    ) {
      if (memoria.suportaXmp && !placa.suportaXmp) {
        alertas.push(
          'A memória anuncia perfil XMP, mas a placa-mãe não informa suporte a XMP.',
        );
      }

      if (memoria.suportaExpo && !placa.suportaExpo) {
        alertas.push(
          'A memória anuncia perfil EXPO, mas a placa-mãe não informa suporte a EXPO.',
        );
      }

      if (!memoria.suportaXmp && !memoria.suportaExpo) {
        alertas.push(
          'A frequência anunciada da memória excede o maior perfil JEDEC cadastrado e pode exigir configuração manual/overclock.',
        );
      }
    }

    const compatibilidadeNaoConfirmada =
      resultadoCpu.compativel === null ||
      resultadoMemoria.status === 'COMPATIVEL_NAO_CONFIRMADO';

    return {
      compativel:
        erros.length > 0 ? false : compatibilidadeNaoConfirmada ? null : true,
      status:
        erros.length > 0
          ? 'INCOMPATIVEL'
          : compatibilidadeNaoConfirmada
            ? 'NAO_CONFIRMADO'
            : alertas.length > 0
              ? 'COMPATIVEL_COM_ALERTAS'
              : 'COMPATIVEL',
      frequenciaMemoria: {
        anunciadaMhz: memoria.frequenciaMhz,
        limiteProcessadorMhz: cpu.frequenciaMemoriaMaximaMhz,
        limitePlacaMaeMhz: frequenciaMaximaPlacaMae,
        estimadaMhz: frequenciaFinalMhz,
      },
      capacidadeTotalGb: capacidadeTotal,
      erros,
      alertas,
      cpuPlacaMae: resultadoCpu,
      memoriaPlacaMae: resultadoMemoria,
    };
  }
  async verificarCompatibilidadePlacaMaeGabinete(
    gabineteId: number,
    placaMaeId: number,
  ) {
    const [gabinete, placaMae] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: gabineteId },
        include: { especificacaoGabinete: true },
      }),
      this.prisma.hardware.findUnique({
        where: { id: placaMaeId },
        include: { especificacaoPlacaMae: true },
      }),
    ]);

    if (!gabinete) {
      throw new NotFoundException('Gabinete não encontrado.');
    }

    if (!placaMae) {
      throw new NotFoundException('Placa-mãe não encontrada.');
    }

    if (gabinete.categoria !== CategoriaHardware.GABINETE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria GABINETE.',
      );
    }

    if (placaMae.categoria !== CategoriaHardware.PLACA_MAE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria PLACA_MAE.',
      );
    }

    if (!gabinete.especificacaoGabinete) {
      throw new BadRequestException(
        'O gabinete não possui especificação técnica cadastrada.',
      );
    }

    if (!placaMae.especificacaoPlacaMae) {
      throw new BadRequestException(
        'A placa-mãe não possui especificação técnica cadastrada.',
      );
    }

    const formatoPlacaMae = placaMae.especificacaoPlacaMae.formato;

    const compativel =
      gabinete.especificacaoGabinete.formatosPlacaMaeSuportados.includes(
        formatoPlacaMae,
      );

    return {
      compativel,
      status: compativel ? 'COMPATIVEL' : 'INCOMPATIVEL',
      motivo: compativel
        ? 'O gabinete suporta o formato desta placa-mãe.'
        : 'O gabinete não suporta o formato desta placa-mãe.',
      gabinete: {
        id: gabinete.id,
        nome: gabinete.nome,
        tamanho: gabinete.especificacaoGabinete.tamanho,
        formatosPlacaMaeSuportados:
          gabinete.especificacaoGabinete.formatosPlacaMaeSuportados,
      },
      placaMae: {
        id: placaMae.id,
        nome: placaMae.nome,
        formato: formatoPlacaMae,
      },
    };
  }

  async verificarCompatibilidadeFonteGabinete(
    gabineteId: number,
    fonteId: number,
  ) {
    const [gabinete, fonte] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: gabineteId },
        include: { especificacaoGabinete: true },
      }),
      this.prisma.hardware.findUnique({
        where: { id: fonteId },
        include: { especificacaoFonte: true },
      }),
    ]);

    if (!gabinete) {
      throw new NotFoundException('Gabinete não encontrado.');
    }

    if (!fonte) {
      throw new NotFoundException('Fonte não encontrada.');
    }

    if (gabinete.categoria !== CategoriaHardware.GABINETE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria GABINETE.',
      );
    }

    if (fonte.categoria !== CategoriaHardware.FONTE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria FONTE.',
      );
    }

    if (!gabinete.especificacaoGabinete) {
      throw new BadRequestException(
        'O gabinete não possui especificação técnica cadastrada.',
      );
    }

    if (!fonte.especificacaoFonte) {
      throw new BadRequestException(
        'A fonte não possui especificação técnica cadastrada.',
      );
    }

    const especificacaoGabinete = gabinete.especificacaoGabinete;
    const especificacaoFonte = fonte.especificacaoFonte;

    const erros: string[] = [];

    if (
      !especificacaoGabinete.formatosFonteSuportados.includes(
        especificacaoFonte.formato,
      )
    ) {
      erros.push('O formato da fonte não é suportado pelo gabinete.');
    }

    if (
      especificacaoGabinete.comprimentoMaximoFonteMm !== null &&
      especificacaoFonte.comprimentoMm !== null &&
      especificacaoFonte.comprimentoMm >
        especificacaoGabinete.comprimentoMaximoFonteMm
    ) {
      erros.push('O comprimento da fonte excede o limite do gabinete.');
    }

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      gabinete: {
        id: gabinete.id,
        nome: gabinete.nome,
        formatosFonteSuportados: especificacaoGabinete.formatosFonteSuportados,
        comprimentoMaximoFonteMm:
          especificacaoGabinete.comprimentoMaximoFonteMm,
      },
      fonte: {
        id: fonte.id,
        nome: fonte.nome,
        formato: especificacaoFonte.formato,
        comprimentoMm: especificacaoFonte.comprimentoMm,
      },
    };
  }
  async verificarCompatibilidadePlacaVideoGabinete(
    gabineteId: number,
    placaVideoId: number,
  ) {
    const [gabinete, placaVideo] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: gabineteId },
        include: { especificacaoGabinete: true },
      }),
      this.prisma.hardware.findUnique({
        where: { id: placaVideoId },
        include: { especificacaoPlacaVideo: true },
      }),
    ]);

    if (!gabinete) {
      throw new NotFoundException('Gabinete não encontrado.');
    }

    if (!placaVideo) {
      throw new NotFoundException('Placa de vídeo não encontrada.');
    }

    if (gabinete.categoria !== CategoriaHardware.GABINETE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria GABINETE.',
      );
    }

    if (placaVideo.categoria !== CategoriaHardware.PLACA_VIDEO) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria PLACA_VIDEO.',
      );
    }

    if (!gabinete.especificacaoGabinete) {
      throw new BadRequestException(
        'O gabinete não possui especificação técnica cadastrada.',
      );
    }

    if (!placaVideo.especificacaoPlacaVideo) {
      throw new BadRequestException(
        'A placa de vídeo não possui especificação técnica cadastrada.',
      );
    }

    const especificacaoGabinete = gabinete.especificacaoGabinete;
    const especificacaoPlacaVideo = placaVideo.especificacaoPlacaVideo;

    const erros: string[] = [];

    if (
      especificacaoGabinete.comprimentoMaximoGpuMm !== null &&
      especificacaoPlacaVideo.comprimentoMm >
        especificacaoGabinete.comprimentoMaximoGpuMm
    ) {
      erros.push(
        'O comprimento da placa de vídeo excede o limite do gabinete.',
      );
    }

    if (
      especificacaoGabinete.alturaMaximaGpuMm !== null &&
      especificacaoPlacaVideo.alturaMm !== null &&
      especificacaoPlacaVideo.alturaMm > especificacaoGabinete.alturaMaximaGpuMm
    ) {
      erros.push('A altura da placa de vídeo excede o limite do gabinete.');
    }

    if (
      especificacaoGabinete.slotsMaximosGpu !== null &&
      especificacaoPlacaVideo.slotsOcupados !== null &&
      especificacaoPlacaVideo.slotsOcupados >
        especificacaoGabinete.slotsMaximosGpu
    ) {
      erros.push(
        'A placa de vídeo ocupa mais slots do que o gabinete suporta.',
      );
    }

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      gabinete: {
        id: gabinete.id,
        nome: gabinete.nome,
        comprimentoMaximoGpuMm: especificacaoGabinete.comprimentoMaximoGpuMm,
        alturaMaximaGpuMm: especificacaoGabinete.alturaMaximaGpuMm,
        slotsMaximosGpu: especificacaoGabinete.slotsMaximosGpu,
      },
      placaVideo: {
        id: placaVideo.id,
        nome: placaVideo.nome,
        comprimentoMm: especificacaoPlacaVideo.comprimentoMm,
        alturaMm: especificacaoPlacaVideo.alturaMm,
        slotsOcupados: especificacaoPlacaVideo.slotsOcupados,
      },
    };
  }
  async verificarCompatibilidadePlacaVideoFonte(
    fonteId: number,
    placaVideoId: number,
  ) {
    const [fonte, placaVideo] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: fonteId },
        include: { especificacaoFonte: true },
      }),
      this.prisma.hardware.findUnique({
        where: { id: placaVideoId },
        include: { especificacaoPlacaVideo: true },
      }),
    ]);

    if (!fonte) {
      throw new NotFoundException('Fonte não encontrada.');
    }

    if (!placaVideo) {
      throw new NotFoundException('Placa de vídeo não encontrada.');
    }

    if (fonte.categoria !== CategoriaHardware.FONTE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria FONTE.',
      );
    }

    if (placaVideo.categoria !== CategoriaHardware.PLACA_VIDEO) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria PLACA_VIDEO.',
      );
    }

    if (!fonte.especificacaoFonte) {
      throw new BadRequestException(
        'A fonte não possui especificação técnica cadastrada.',
      );
    }

    if (!placaVideo.especificacaoPlacaVideo) {
      throw new BadRequestException(
        'A placa de vídeo não possui especificação técnica cadastrada.',
      );
    }

    const especificacaoFonte = fonte.especificacaoFonte;
    const especificacaoPlacaVideo = placaVideo.especificacaoPlacaVideo;

    const erros: string[] = [];

    if (
      especificacaoPlacaVideo.potenciaFonteRecomendadaWatts !== null &&
      especificacaoFonte.potenciaWatts <
        especificacaoPlacaVideo.potenciaFonteRecomendadaWatts
    ) {
      erros.push(
        'A potência da fonte é menor que a recomendada para a placa de vídeo.',
      );
    }

    if (
      especificacaoFonte.conectoresPcie6Pinos <
      especificacaoPlacaVideo.conectoresPcie6Pinos
    ) {
      erros.push('A fonte não possui conectores PCIe de 6 pinos suficientes.');
    }

    if (
      especificacaoFonte.conectoresPcie8Pinos <
      especificacaoPlacaVideo.conectoresPcie8Pinos
    ) {
      erros.push('A fonte não possui conectores PCIe de 8 pinos suficientes.');
    }

    if (
      especificacaoFonte.conectores12vhpwr <
      especificacaoPlacaVideo.conectores12vhpwr
    ) {
      erros.push('A fonte não possui conectores 12VHPWR suficientes.');
    }

    if (
      especificacaoFonte.conectores12v2x6 <
      especificacaoPlacaVideo.conectores12v2x6
    ) {
      erros.push('A fonte não possui conectores 12V-2x6 suficientes.');
    }

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      fonte: {
        id: fonte.id,
        nome: fonte.nome,
        potenciaWatts: especificacaoFonte.potenciaWatts,
        conectoresPcie6Pinos: especificacaoFonte.conectoresPcie6Pinos,
        conectoresPcie8Pinos: especificacaoFonte.conectoresPcie8Pinos,
        conectores12vhpwr: especificacaoFonte.conectores12vhpwr,
        conectores12v2x6: especificacaoFonte.conectores12v2x6,
      },
      placaVideo: {
        id: placaVideo.id,
        nome: placaVideo.nome,
        potenciaFonteRecomendadaWatts:
          especificacaoPlacaVideo.potenciaFonteRecomendadaWatts,
        conectoresPcie6Pinos: especificacaoPlacaVideo.conectoresPcie6Pinos,
        conectoresPcie8Pinos: especificacaoPlacaVideo.conectoresPcie8Pinos,
        conectores12vhpwr: especificacaoPlacaVideo.conectores12vhpwr,
        conectores12v2x6: especificacaoPlacaVideo.conectores12v2x6,
      },
    };
  }
  async verificarCompatibilidadeArmazenamentoPlacaMae(
    placaMaeId: number,
    armazenamentoId: number,
  ) {
    const [placaMae, armazenamento] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: placaMaeId },
        include: {
          especificacaoPlacaMae: {
            include: {
              slotsM2: {
                where: {
                  ativo: true,
                },
                orderBy: {
                  id: 'asc',
                },
              },
            },
          },
        },
      }),
      this.prisma.hardware.findUnique({
        where: { id: armazenamentoId },
        include: {
          especificacaoArmazenamento: true,
        },
      }),
    ]);

    if (!placaMae) {
      throw new NotFoundException('Placa-mãe não encontrada.');
    }

    if (!armazenamento) {
      throw new NotFoundException('Armazenamento não encontrado.');
    }

    if (placaMae.categoria !== CategoriaHardware.PLACA_MAE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria PLACA_MAE.',
      );
    }

    if (armazenamento.categoria !== CategoriaHardware.ARMAZENAMENTO) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria ARMAZENAMENTO.',
      );
    }

    if (!placaMae.especificacaoPlacaMae) {
      throw new BadRequestException(
        'A placa-mãe não possui especificação técnica cadastrada.',
      );
    }

    if (!armazenamento.especificacaoArmazenamento) {
      throw new BadRequestException(
        'O armazenamento não possui especificação técnica cadastrada.',
      );
    }

    const especificacaoPlacaMae = placaMae.especificacaoPlacaMae;
    const especificacaoArmazenamento = armazenamento.especificacaoArmazenamento;

    const erros: string[] = [];
    const alertas: string[] = [];

    const slotsM2Compativeis = especificacaoPlacaMae.slotsM2.filter((slot) => {
      if (
        !slot.interfacesSuportadas.includes(
          especificacaoArmazenamento.interface,
        )
      ) {
        return false;
      }

      if (
        especificacaoArmazenamento.tamanhoM2Mm !== null &&
        !slot.tamanhosSuportadosMm.includes(
          especificacaoArmazenamento.tamanhoM2Mm,
        )
      ) {
        return false;
      }

      if (especificacaoArmazenamento.chaveM2 !== null) {
        const chave = especificacaoArmazenamento.chaveM2;

        const chaveCompativel =
          slot.chavesSuportadas.includes(chave) ||
          (chave === ChaveM2.B_M &&
            (slot.chavesSuportadas.includes(ChaveM2.B) ||
              slot.chavesSuportadas.includes(ChaveM2.M)));

        if (!chaveCompativel) {
          return false;
        }
      }

      return true;
    });

    const armazenamentoM2 =
      especificacaoArmazenamento.formato === FormatoArmazenamento.M2;

    if (armazenamentoM2) {
      if (especificacaoArmazenamento.tamanhoM2Mm === null) {
        erros.push('O armazenamento M.2 não possui o tamanho cadastrado.');
      }

      if (especificacaoArmazenamento.chaveM2 === null) {
        erros.push('O armazenamento M.2 não possui a chave cadastrada.');
      }

      if (
        especificacaoArmazenamento.interface !== InterfaceArmazenamento.SATA &&
        especificacaoArmazenamento.interface !==
          InterfaceArmazenamento.NVME_PCIE
      ) {
        erros.push(
          'A interface informada não é válida para um armazenamento M.2.',
        );
      }

      if (slotsM2Compativeis.length === 0) {
        erros.push(
          'Nenhum slot M.2 da placa-mãe é compatível com este armazenamento.',
        );
      }
    } else if (
      especificacaoArmazenamento.formato === FormatoArmazenamento.PLACA_PCIE
    ) {
      if (
        especificacaoArmazenamento.interface !==
        InterfaceArmazenamento.NVME_PCIE
      ) {
        erros.push(
          'Armazenamento em placa PCIe deve utilizar interface NVMe/PCIe.',
        );
      } else {
        alertas.push(
          'A placa de armazenamento usa slot PCIe; a disponibilidade e largura exata do slot não podem ser confirmadas completamente com os dados atuais da placa-mãe.',
        );
      }
    } else if (
      especificacaoArmazenamento.interface === InterfaceArmazenamento.SATA
    ) {
      if (especificacaoPlacaMae.portasSata < 1) {
        erros.push('A placa-mãe não possui portas SATA disponíveis.');
      }
    } else {
      erros.push(
        'A placa-mãe não possui suporte cadastrado para a interface deste armazenamento.',
      );
    }

    if (
      especificacaoArmazenamento.interface ===
        InterfaceArmazenamento.NVME_PCIE &&
      slotsM2Compativeis.length > 0
    ) {
      const geracoesDisponiveis = slotsM2Compativeis
        .map((slot) => slot.geracaoPcieMaxima)
        .filter((geracao): geracao is number => geracao !== null);

      const pistasDisponiveis = slotsM2Compativeis
        .map((slot) => slot.pistasPcie)
        .filter((pistas): pistas is number => pistas !== null);

      if (
        especificacaoArmazenamento.geracaoPcie !== null &&
        geracoesDisponiveis.length > 0 &&
        especificacaoArmazenamento.geracaoPcie >
          Math.max(...geracoesDisponiveis)
      ) {
        alertas.push(
          'O armazenamento funcionará limitado à geração PCIe máxima do slot.',
        );
      }

      if (
        especificacaoArmazenamento.pistasPcie !== null &&
        pistasDisponiveis.length > 0 &&
        especificacaoArmazenamento.pistasPcie > Math.max(...pistasDisponiveis)
      ) {
        alertas.push(
          'O armazenamento funcionará limitado à quantidade de pistas PCIe do slot.',
        );
      }
    }

    if (
      especificacaoArmazenamento.interface === InterfaceArmazenamento.SATA &&
      armazenamentoM2
    ) {
      alertas.push(
        'O uso deste armazenamento M.2 SATA pode compartilhar recursos com portas SATA da placa-mãe.',
      );
    }

    const slotsM2ComDesempenho = armazenamentoM2
      ? slotsM2Compativeis.map((slot) => {
          const limitacoes: string[] = [];

          if (
            especificacaoArmazenamento.geracaoPcie !== null &&
            slot.geracaoPcieMaxima !== null &&
            especificacaoArmazenamento.geracaoPcie > slot.geracaoPcieMaxima
          ) {
            limitacoes.push(
              `Funcionará limitado ao PCIe ${slot.geracaoPcieMaxima}.0.`,
            );
          }

          if (
            especificacaoArmazenamento.pistasPcie !== null &&
            slot.pistasPcie !== null &&
            especificacaoArmazenamento.pistasPcie > slot.pistasPcie
          ) {
            limitacoes.push(
              `Funcionará limitado a ${slot.pistasPcie} pistas PCIe.`,
            );
          }

          return {
            ...slot,
            desempenho: limitacoes.length === 0 ? 'MAXIMO' : 'LIMITADO',
            limitacoes,
          };
        })
      : [];

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      alertas,
      placaMae: {
        id: placaMae.id,
        nome: placaMae.nome,
        portasSata: especificacaoPlacaMae.portasSata,
      },
      armazenamento: {
        id: armazenamento.id,
        nome: armazenamento.nome,
        tipo: especificacaoArmazenamento.tipo,
        formato: especificacaoArmazenamento.formato,
        interface: especificacaoArmazenamento.interface,
        capacidadeGb: especificacaoArmazenamento.capacidadeGb,
        tamanhoM2Mm: especificacaoArmazenamento.tamanhoM2Mm,
        chaveM2: especificacaoArmazenamento.chaveM2,
        geracaoPcie: especificacaoArmazenamento.geracaoPcie,
        pistasPcie: especificacaoArmazenamento.pistasPcie,
      },
      slotsM2Compativeis: slotsM2ComDesempenho,
    };
  }
  async verificarCompatibilidadeVentoinhaGabinete(
    gabineteId: number,
    ventoinhaId: number,
    posicao: string,
    quantidade: number,
  ) {
    const [gabinete, ventoinha] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: gabineteId },
        include: {
          especificacaoGabinete: {
            include: {
              suportesFans: true,
            },
          },
        },
      }),
      this.prisma.hardware.findUnique({
        where: { id: ventoinhaId },
        include: {
          especificacaoVentoinha: true,
        },
      }),
    ]);

    if (!gabinete) {
      throw new NotFoundException('Gabinete não encontrado.');
    }

    if (!ventoinha) {
      throw new NotFoundException('Ventoinha não encontrada.');
    }

    if (gabinete.categoria !== CategoriaHardware.GABINETE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria GABINETE.',
      );
    }

    if (ventoinha.categoria !== CategoriaHardware.VENTOINHA) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria VENTOINHA.',
      );
    }

    if (!gabinete.especificacaoGabinete) {
      throw new BadRequestException(
        'O gabinete não possui especificação técnica cadastrada.',
      );
    }

    if (!ventoinha.especificacaoVentoinha) {
      throw new BadRequestException(
        'A ventoinha não possui especificação técnica cadastrada.',
      );
    }

    if (!Number.isInteger(quantidade) || quantidade < 1) {
      throw new BadRequestException(
        'A quantidade de ventoinhas deve ser um número inteiro maior que zero.',
      );
    }

    const especificacaoVentoinha = ventoinha.especificacaoVentoinha;

    const suporte = gabinete.especificacaoGabinete.suportesFans.find(
      (item) =>
        item.posicao === posicao &&
        item.tamanhoMm === especificacaoVentoinha.tamanhoMm,
    );

    const erros: string[] = [];

    if (!suporte) {
      erros.push('O gabinete não suporta esta ventoinha na posição informada.');
    } else {
      if (quantidade > suporte.quantidadeMaxima) {
        erros.push('A quantidade de ventoinhas excede o limite dessa posição.');
      }

      if (
        suporte.espessuraMaximaMm !== null &&
        especificacaoVentoinha.espessuraMm !== null &&
        especificacaoVentoinha.espessuraMm > suporte.espessuraMaximaMm
      ) {
        erros.push('A espessura da ventoinha excede o limite dessa posição.');
      }
    }

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      posicao,
      quantidade,
      gabinete: {
        id: gabinete.id,
        nome: gabinete.nome,
      },
      ventoinha: {
        id: ventoinha.id,
        nome: ventoinha.nome,
        tamanhoMm: especificacaoVentoinha.tamanhoMm,
        espessuraMm: especificacaoVentoinha.espessuraMm,
      },
      suporte: suporte ?? null,
    };
  }
  async verificarCompatibilidadeCoolerProcessadorGabinete(
    gabineteId: number,
    processadorId: number,
    coolerId: number,
    memoriaRamId?: number,
  ) {
    const [gabinete, processador, cooler] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: gabineteId },
        include: {
          especificacaoGabinete: {
            include: {
              suportesRadiador: true,
            },
          },
        },
      }),
      this.prisma.hardware.findUnique({
        where: { id: processadorId },
        include: {
          especificacaoProcessador: true,
        },
      }),
      this.prisma.hardware.findUnique({
        where: { id: coolerId },
        include: {
          especificacaoCooler: true,
        },
      }),
    ]);

    const memoriaRam =
      memoriaRamId !== undefined
        ? await this.prisma.hardware.findUnique({
            where: { id: memoriaRamId },
            include: { especificacaoMemoriaRam: true },
          })
        : null;

    if (!gabinete) {
      throw new NotFoundException('Gabinete não encontrado.');
    }

    if (!processador) {
      throw new NotFoundException('Processador não encontrado.');
    }

    if (!cooler) {
      throw new NotFoundException('Cooler não encontrado.');
    }

    if (gabinete.categoria !== CategoriaHardware.GABINETE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria GABINETE.',
      );
    }

    if (processador.categoria !== CategoriaHardware.PROCESSADOR) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria PROCESSADOR.',
      );
    }

    if (cooler.categoria !== CategoriaHardware.COOLER) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria COOLER.',
      );
    }

    if (!gabinete.especificacaoGabinete) {
      throw new BadRequestException(
        'O gabinete não possui especificação técnica cadastrada.',
      );
    }

    if (!processador.especificacaoProcessador) {
      throw new BadRequestException(
        'O processador não possui especificação técnica cadastrada.',
      );
    }

    if (!cooler.especificacaoCooler) {
      throw new BadRequestException(
        'O cooler não possui especificação técnica cadastrada.',
      );
    }

    const especificacaoGabinete = gabinete.especificacaoGabinete;
    const especificacaoProcessador = processador.especificacaoProcessador;
    const especificacaoCooler = cooler.especificacaoCooler;

    const erros: string[] = [];
    const alertas: string[] = [];

    if (
      !especificacaoCooler.socketsSuportados.includes(
        especificacaoProcessador.socket,
      )
    ) {
      erros.push(
        `O cooler não oferece suporte ao socket ${especificacaoProcessador.socket}.`,
      );
    }

    if (
      especificacaoCooler.capacidadeTermicaWatts !== null &&
      especificacaoProcessador.tdpWatts !== null
    ) {
      if (
        especificacaoCooler.capacidadeTermicaWatts <
        especificacaoProcessador.tdpWatts
      ) {
        erros.push(
          'A capacidade térmica do cooler é inferior ao TDP do processador.',
        );
      }
    } else {
      alertas.push(
        'Não foi possível validar completamente a capacidade térmica do cooler.',
      );
    }

    let suporteRadiador: SuporteRadiadorGabinete | null = null;

    if (especificacaoCooler.tipo === TipoCooler.AIR_COOLER) {
      if (
        especificacaoCooler.alturaMm !== null &&
        especificacaoGabinete.alturaMaximaCoolerCpuMm !== null
      ) {
        if (
          especificacaoCooler.alturaMm >
          especificacaoGabinete.alturaMaximaCoolerCpuMm
        ) {
          erros.push(
            'A altura do cooler excede o limite suportado pelo gabinete.',
          );
        }
      } else {
        alertas.push(
          'Não foi possível validar completamente a altura do cooler no gabinete.',
        );
      }
    }

    if (
      especificacaoCooler.tipo === TipoCooler.AIR_COOLER &&
      memoriaRamId !== undefined
    ) {
      if (!memoriaRam) {
        throw new NotFoundException('Memória RAM não encontrada.');
      }

      if (memoriaRam.categoria !== CategoriaHardware.MEMORIA_RAM) {
        throw new BadRequestException(
          'O hardware informado não pertence à categoria MEMORIA_RAM.',
        );
      }

      const especificacaoMemoria = memoriaRam.especificacaoMemoriaRam;
      if (!especificacaoMemoria) {
        alertas.push(
          'Não foi possível validar a folga entre o air cooler e a memória RAM.',
        );
      } else if (
        especificacaoCooler.alturaLivreRamMm !== null &&
        especificacaoMemoria.alturaMm !== null &&
        especificacaoMemoria.alturaMm > especificacaoCooler.alturaLivreRamMm
      ) {
        erros.push(
          'A altura da memória RAM excede a folga informada sob o air cooler.',
        );
      } else if (
        especificacaoCooler.alturaLivreRamMm === null ||
        especificacaoMemoria.alturaMm === null
      ) {
        alertas.push(
          'Não foi possível validar completamente a folga entre o air cooler e a memória RAM.',
        );
      }
    }

    if (especificacaoCooler.tipo === TipoCooler.WATER_COOLER) {
      if (especificacaoCooler.tamanhoRadiadorMm === null) {
        erros.push(
          'O water cooler não possui o tamanho do radiador cadastrado.',
        );
      } else {
        suporteRadiador =
          especificacaoGabinete.suportesRadiador.find(
            (suporte) =>
              suporte.tamanhoMm === especificacaoCooler.tamanhoRadiadorMm,
          ) ?? null;

        if (!suporteRadiador) {
          erros.push(
            'O gabinete não possui suporte para o tamanho deste radiador.',
          );
        } else if (
          suporteRadiador.espessuraConjuntoMaximaMm !== null &&
          especificacaoCooler.espessuraRadiadorMm !== null &&
          especificacaoCooler.espessuraVentoinhaMm !== null
        ) {
          const espessuraTotal =
            especificacaoCooler.espessuraRadiadorMm +
            especificacaoCooler.espessuraVentoinhaMm;

          if (espessuraTotal > suporteRadiador.espessuraConjuntoMaximaMm) {
            erros.push(
              'A espessura total do radiador e das ventoinhas excede o limite do gabinete.',
            );
          }
        } else {
          alertas.push(
            'Não foi possível validar completamente a espessura do conjunto do radiador.',
          );
        }
      }
    }

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      alertas,
      gabinete: {
        id: gabinete.id,
        nome: gabinete.nome,
        alturaMaximaCoolerCpuMm: especificacaoGabinete.alturaMaximaCoolerCpuMm,
      },
      processador: {
        id: processador.id,
        nome: processador.nome,
        socket: especificacaoProcessador.socket,
        tdpWatts: especificacaoProcessador.tdpWatts,
      },
      cooler: {
        id: cooler.id,
        nome: cooler.nome,
        tipo: especificacaoCooler.tipo,
        socketsSuportados: especificacaoCooler.socketsSuportados,
        capacidadeTermicaWatts: especificacaoCooler.capacidadeTermicaWatts,
        alturaMm: especificacaoCooler.alturaMm,
        tamanhoRadiadorMm: especificacaoCooler.tamanhoRadiadorMm,
      },
      memoriaRam: memoriaRam?.especificacaoMemoriaRam
        ? {
            id: memoriaRam.id,
            nome: memoriaRam.nome,
            alturaMm: memoriaRam.especificacaoMemoriaRam.alturaMm,
          }
        : null,
      suporteRadiador,
    };
  }
  async verificarCompatibilidadeArmazenamentoGabinete(
    gabineteId: number,
    armazenamentoId: number,
  ) {
    const [gabinete, armazenamento] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: gabineteId },
        include: {
          especificacaoGabinete: true,
        },
      }),
      this.prisma.hardware.findUnique({
        where: { id: armazenamentoId },
        include: {
          especificacaoArmazenamento: true,
        },
      }),
    ]);

    if (!gabinete) {
      throw new NotFoundException('Gabinete não encontrado.');
    }

    if (!armazenamento) {
      throw new NotFoundException('Armazenamento não encontrado.');
    }

    if (gabinete.categoria !== CategoriaHardware.GABINETE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria GABINETE.',
      );
    }

    if (armazenamento.categoria !== CategoriaHardware.ARMAZENAMENTO) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria ARMAZENAMENTO.',
      );
    }

    if (!gabinete.especificacaoGabinete) {
      throw new BadRequestException(
        'O gabinete não possui especificação técnica cadastrada.',
      );
    }

    if (!armazenamento.especificacaoArmazenamento) {
      throw new BadRequestException(
        'O armazenamento não possui especificação técnica cadastrada.',
      );
    }

    const especificacaoGabinete = gabinete.especificacaoGabinete;
    const especificacaoArmazenamento = armazenamento.especificacaoArmazenamento;

    const erros: string[] = [];
    const alertas: string[] = [];

    let tipoInstalacao: string;

    switch (especificacaoArmazenamento.formato) {
      case FormatoArmazenamento.POLEGADAS_2_5:
        tipoInstalacao = 'BAIA_2_5';

        if (especificacaoGabinete.baias25 < 1) {
          erros.push('O gabinete não possui baia de 2,5 polegadas disponível.');
        }
        break;

      case FormatoArmazenamento.POLEGADAS_3_5:
        tipoInstalacao = 'BAIA_3_5';

        if (especificacaoGabinete.baias35 < 1) {
          erros.push('O gabinete não possui baia de 3,5 polegadas disponível.');
        }
        break;

      case FormatoArmazenamento.M2:
        tipoInstalacao = 'PLACA_MAE';

        alertas.push(
          'O armazenamento M.2 é instalado na placa-mãe e não utiliza uma baia do gabinete.',
        );
        break;

      case FormatoArmazenamento.PLACA_PCIE:
        tipoInstalacao = 'SLOT_TRASEIRO';

        if (especificacaoGabinete.slotsTraseiros === null) {
          alertas.push(
            'O gabinete não possui a quantidade de slots traseiros cadastrada.',
          );
        } else if (especificacaoGabinete.slotsTraseiros < 1) {
          erros.push(
            'O gabinete não possui slot traseiro para este armazenamento PCIe.',
          );
        }
        break;

      default:
        tipoInstalacao = 'DESCONHECIDO';

        erros.push(
          'O formato deste armazenamento não possui uma regra de instalação cadastrada.',
        );
    }

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      alertas,
      tipoInstalacao,
      gabinete: {
        id: gabinete.id,
        nome: gabinete.nome,
        baias25: especificacaoGabinete.baias25,
        baias35: especificacaoGabinete.baias35,
        slotsTraseiros: especificacaoGabinete.slotsTraseiros,
      },
      armazenamento: {
        id: armazenamento.id,
        nome: armazenamento.nome,
        tipo: especificacaoArmazenamento.tipo,
        formato: especificacaoArmazenamento.formato,
        interface: especificacaoArmazenamento.interface,
        capacidadeGb: especificacaoArmazenamento.capacidadeGb,
      },
    };
  }

  private async verificarSaidaVideoMontagem(
    placaMaeId: number,
    processadorId: number,
    placaVideoId?: number,
  ) {
    if (placaVideoId !== undefined) {
      return {
        compativel: true,
        status: 'COMPATIVEL',
        erros: [],
        alertas: [],
        modoVideo: 'DEDICADA',
      };
    }

    const [placaMae, processador] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: placaMaeId },
        include: { especificacaoPlacaMae: true },
      }),
      this.prisma.hardware.findUnique({
        where: { id: processadorId },
        include: { especificacaoProcessador: true },
      }),
    ]);

    if (!placaMae?.especificacaoPlacaMae) {
      throw new BadRequestException(
        'A placa-mãe não possui especificação técnica para validar a saída de vídeo.',
      );
    }

    if (!processador?.especificacaoProcessador) {
      throw new BadRequestException(
        'O processador não possui especificação técnica para validar a saída de vídeo.',
      );
    }

    const erros: string[] = [];

    if (!processador.especificacaoProcessador.possuiVideoIntegrado) {
      erros.push(
        'A montagem não possui placa de vídeo dedicada e o processador não possui vídeo integrado.',
      );
    }

    if (placaMae.especificacaoPlacaMae.saidasVideo.length === 0) {
      erros.push(
        'A montagem não possui placa de vídeo dedicada e a placa-mãe não possui saída de vídeo cadastrada para usar o vídeo integrado.',
      );
    }

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      alertas: [],
      modoVideo: erros.length === 0 ? 'INTEGRADA' : 'INDISPONIVEL',
      processador: {
        id: processador.id,
        nome: processador.nome,
        possuiVideoIntegrado:
          processador.especificacaoProcessador.possuiVideoIntegrado,
        modeloVideoIntegrado:
          processador.especificacaoProcessador.modeloVideoIntegrado,
      },
      placaMae: {
        id: placaMae.id,
        nome: placaMae.nome,
        saidasVideo: placaMae.especificacaoPlacaMae.saidasVideo,
      },
    };
  }

  private async verificarAlimentacaoPrincipalFonte(fonteId: number) {
    const fonte = await this.prisma.hardware.findUnique({
      where: { id: fonteId },
      include: { especificacaoFonte: true },
    });

    if (!fonte) {
      throw new NotFoundException('Fonte não encontrada.');
    }

    if (fonte.categoria !== CategoriaHardware.FONTE) {
      throw new BadRequestException(
        'O hardware informado não pertence à categoria FONTE.',
      );
    }

    if (!fonte.especificacaoFonte) {
      throw new BadRequestException(
        'A fonte não possui especificação técnica cadastrada.',
      );
    }

    const erros: string[] = [];

    if (fonte.especificacaoFonte.conectoresAtx24Pinos < 1) {
      erros.push(
        'A fonte não possui conector ATX de 24 pinos para alimentar a placa-mãe.',
      );
    }

    if (fonte.especificacaoFonte.conectoresEpsCpu < 1) {
      erros.push(
        'A fonte não possui conector EPS/CPU para alimentar o processador.',
      );
    }

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      alertas: [],
      fonte: {
        id: fonte.id,
        nome: fonte.nome,
        conectoresAtx24Pinos: fonte.especificacaoFonte.conectoresAtx24Pinos,
        conectoresEpsCpu: fonte.especificacaoFonte.conectoresEpsCpu,
      },
    };
  }

  private async verificarOcupacaoVentoinhasMontagem(
    dados: VerificarCompatibilidadeMontagemDto,
  ) {
    const configuracoes = dados.ventoinhas ?? [];

    if (configuracoes.length === 0) {
      return {
        compativel: true,
        status: 'COMPATIVEL',
        erros: [],
        alertas: [],
        ocupacoes: [],
      };
    }

    const [gabinete, ventoinhas] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: dados.gabineteId },
        include: {
          especificacaoGabinete: {
            include: { suportesFans: true },
          },
        },
      }),
      this.prisma.hardware.findMany({
        where: {
          id: { in: configuracoes.map((item) => item.ventoinhaId) },
        },
        include: { especificacaoVentoinha: true },
      }),
    ]);

    if (!gabinete?.especificacaoGabinete) {
      throw new BadRequestException(
        'O gabinete não possui especificação técnica para validar a ocupação das ventoinhas.',
      );
    }

    const ventoinhasPorId = new Map(
      ventoinhas.map((ventoinha) => [ventoinha.id, ventoinha]),
    );
    const ocupacao = new Map<
      string,
      {
        posicao: PosicaoRefrigeracaoGabinete;
        tamanhoMm: number;
        quantidade: number;
      }
    >();
    const erros: string[] = [];

    for (const item of configuracoes) {
      const ventoinha = ventoinhasPorId.get(item.ventoinhaId);
      const especificacao = ventoinha?.especificacaoVentoinha;

      if (!ventoinha || !especificacao) {
        erros.push(
          `Não foi possível validar a ocupação da ventoinha ID ${item.ventoinhaId}.`,
        );
        continue;
      }

      const chave = `${item.posicao}:${especificacao.tamanhoMm}`;
      const atual = ocupacao.get(chave) ?? {
        posicao: item.posicao,
        tamanhoMm: especificacao.tamanhoMm,
        quantidade: 0,
      };
      atual.quantidade += item.quantidade;
      ocupacao.set(chave, atual);
    }

    const ocupacoes = [...ocupacao.values()].map((item) => {
      const suporte = gabinete.especificacaoGabinete.suportesFans.find(
        (suporte) =>
          suporte.posicao === item.posicao &&
          suporte.tamanhoMm === item.tamanhoMm,
      );

      if (!suporte) {
        erros.push(
          `O gabinete não possui suporte para ventoinhas de ${item.tamanhoMm} mm na posição ${item.posicao}.`,
        );
      } else if (item.quantidade > suporte.quantidadeMaxima) {
        erros.push(
          `A posição ${item.posicao} suporta no máximo ${suporte.quantidadeMaxima} ventoinha(s) de ${item.tamanhoMm} mm, mas a montagem utiliza ${item.quantidade}.`,
        );
      }

      return {
        ...item,
        quantidadeMaxima: suporte?.quantidadeMaxima ?? null,
      };
    });

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      alertas: [],
      ocupacoes,
    };
  }

  private async calcularFluxoArMontagem(
    dados: VerificarCompatibilidadeMontagemDto,
  ) {
    const configuracoes = dados.ventoinhas ?? [];
    const alertas: string[] = [];

    if (configuracoes.length === 0) {
      return {
        compativel: true,
        status: 'ATENCAO',
        erros: [],
        alertas: [
          'Nenhuma ventoinha foi informada para analisar o fluxo de ar.',
        ],
        classificacao: 'NAO_CALCULADO',
        entrada: {
          quantidade: 0,
          fluxoArCfm: 0,
        },
        saida: {
          quantidade: 0,
          fluxoArCfm: 0,
        },
      };
    }

    const ventoinhas = await this.prisma.hardware.findMany({
      where: {
        id: {
          in: configuracoes.map((item) => item.ventoinhaId),
        },
      },
      include: {
        especificacaoVentoinha: true,
      },
    });

    const ventoinhasPorId = new Map(
      ventoinhas.map((ventoinha) => [ventoinha.id, ventoinha]),
    );

    const obterSentidoPadrao = (
      posicao: PosicaoRefrigeracaoGabinete,
    ): SentidoFluxoAr => {
      switch (posicao) {
        case PosicaoRefrigeracaoGabinete.TOPO:
        case PosicaoRefrigeracaoGabinete.TRASEIRA:
          return SentidoFluxoAr.SAIDA;

        case PosicaoRefrigeracaoGabinete.FRENTE:
        case PosicaoRefrigeracaoGabinete.INFERIOR:
        case PosicaoRefrigeracaoGabinete.LATERAL:
        default:
          return SentidoFluxoAr.ENTRADA;
      }
    };

    let quantidadeEntrada = 0;
    let quantidadeSaida = 0;
    let fluxoEntradaCfm = 0;
    let fluxoSaidaCfm = 0;
    let possuiFluxoNaoCadastrado = false;

    const detalhes = configuracoes.map((item) => {
      const ventoinha = ventoinhasPorId.get(item.ventoinhaId);
      const especificacao = ventoinha?.especificacaoVentoinha;
      const sentido = item.sentido ?? obterSentidoPadrao(item.posicao);

      if (!ventoinha || !especificacao) {
        alertas.push(
          `Não foi possível analisar a ventoinha ID ${item.ventoinhaId}.`,
        );

        return {
          ventoinhaId: item.ventoinhaId,
          posicao: item.posicao,
          sentido,
          quantidade: item.quantidade,
          fluxoArTotalCfm: null,
        };
      }

      const fluxoUnitarioCfm = especificacao.fluxoArCfm;

      if (fluxoUnitarioCfm === null) {
        possuiFluxoNaoCadastrado = true;
      }

      const fluxoTotalCfm =
        fluxoUnitarioCfm === null ? 0 : fluxoUnitarioCfm * item.quantidade;

      if (sentido === SentidoFluxoAr.ENTRADA) {
        quantidadeEntrada += item.quantidade;
        fluxoEntradaCfm += fluxoTotalCfm;
      } else {
        quantidadeSaida += item.quantidade;
        fluxoSaidaCfm += fluxoTotalCfm;
      }

      return {
        ventoinhaId: ventoinha.id,
        nome: ventoinha.nome,
        posicao: item.posicao,
        sentido,
        quantidade: item.quantidade,
        fluxoArUnitarioCfm: fluxoUnitarioCfm,
        fluxoArTotalCfm:
          fluxoUnitarioCfm === null ? null : Number(fluxoTotalCfm.toFixed(2)),
      };
    });

    if (quantidadeEntrada === 0) {
      alertas.push('Não há ventoinhas configuradas para entrada de ar.');
    }

    if (quantidadeSaida === 0) {
      alertas.push(
        'Não há ventoinhas configuradas para exaustão do ar quente.',
      );
    }

    if (possuiFluxoNaoCadastrado) {
      alertas.push(
        'Algumas ventoinhas não possuem CFM cadastrado; a pressão foi estimada pela quantidade.',
      );
    }

    const usarFluxoCfm =
      !possuiFluxoNaoCadastrado && fluxoEntradaCfm + fluxoSaidaCfm > 0;

    const valorEntrada = usarFluxoCfm ? fluxoEntradaCfm : quantidadeEntrada;

    const valorSaida = usarFluxoCfm ? fluxoSaidaCfm : quantidadeSaida;

    let classificacao:
      'POSITIVA' | 'NEGATIVA' | 'EQUILIBRADA' | 'NAO_CALCULADO';

    if (valorEntrada === 0 && valorSaida === 0) {
      classificacao = 'NAO_CALCULADO';
    } else if (valorEntrada > valorSaida * 1.1) {
      classificacao = 'POSITIVA';

      alertas.push(
        'A montagem possui pressão positiva estimada, com maior entrada do que saída de ar.',
      );
    } else if (valorSaida > valorEntrada * 1.1) {
      classificacao = 'NEGATIVA';

      alertas.push(
        'A montagem possui pressão negativa estimada, o que pode aumentar a entrada de poeira por aberturas sem filtro.',
      );
    } else {
      classificacao = 'EQUILIBRADA';
    }

    return {
      compativel: true,
      status: alertas.length === 0 ? 'ADEQUADO' : 'ATENCAO',
      erros: [],
      alertas,
      classificacao,
      criterioCalculo: usarFluxoCfm ? 'CFM' : 'QUANTIDADE',
      entrada: {
        quantidade: quantidadeEntrada,
        fluxoArCfm: Number(fluxoEntradaCfm.toFixed(2)),
      },
      saida: {
        quantidade: quantidadeSaida,
        fluxoArCfm: Number(fluxoSaidaCfm.toFixed(2)),
      },
      diferencaCfm: Number((fluxoEntradaCfm - fluxoSaidaCfm).toFixed(2)),
      detalhes,
    };
  }

  private async calcularConsumoEstimadoMontagem(
    dados: VerificarCompatibilidadeMontagemDto,
  ) {
    const [processador, fonte, armazenamentos, ventoinhas] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: dados.processadorId },
        include: {
          especificacaoProcessador: true,
        },
      }),

      this.prisma.hardware.findUnique({
        where: { id: dados.fonteId },
        include: {
          especificacaoFonte: true,
        },
      }),

      this.prisma.hardware.findMany({
        where: {
          id: {
            in: dados.armazenamentoIds ?? [],
          },
        },
        include: {
          especificacaoArmazenamento: true,
        },
      }),

      this.prisma.hardware.findMany({
        where: {
          id: {
            in: (dados.ventoinhas ?? []).map(
              (ventoinha) => ventoinha.ventoinhaId,
            ),
          },
        },
        include: {
          especificacaoVentoinha: true,
        },
      }),
    ]);

    const placaVideo =
      dados.placaVideoId !== undefined
        ? await this.prisma.hardware.findUnique({
            where: { id: dados.placaVideoId },
            include: {
              especificacaoPlacaVideo: true,
            },
          })
        : null;

    const cooler =
      dados.coolerId !== undefined
        ? await this.prisma.hardware.findUnique({
            where: { id: dados.coolerId },
            include: {
              especificacaoCooler: true,
            },
          })
        : null;

    if (!processador?.especificacaoProcessador) {
      throw new BadRequestException(
        'O processador não possui especificação técnica para calcular o consumo.',
      );
    }

    if (!fonte?.especificacaoFonte) {
      throw new BadRequestException(
        'A fonte não possui especificação técnica para calcular a potência disponível.',
      );
    }

    const alertas: string[] = [];
    const erros: string[] = [];

    const consumoProcessadorWatts =
      processador.especificacaoProcessador.tdpWatts ?? 0;

    if (processador.especificacaoProcessador.tdpWatts === null) {
      alertas.push(
        'O processador não possui TDP cadastrado e não foi incluído completamente no cálculo.',
      );
    }

    const consumoPlacaVideoWatts =
      placaVideo?.especificacaoPlacaVideo?.consumoWatts ?? 0;

    if (
      dados.placaVideoId !== undefined &&
      placaVideo?.especificacaoPlacaVideo?.consumoWatts === null
    ) {
      alertas.push(
        'A placa de vídeo não possui consumo cadastrado e não foi incluída completamente no cálculo.',
      );
    }

    const armazenamentosPorId = new Map(
      armazenamentos.map((armazenamento) => [armazenamento.id, armazenamento]),
    );

    // Recria a lista seguindo exatamente os IDs recebidos para preservar
    // múltiplas instâncias físicas do mesmo produto (ex.: dois SSDs iguais).
    const armazenamentosDaMontagem = (dados.armazenamentoIds ?? []).flatMap(
      (armazenamentoId) => {
        const armazenamento = armazenamentosPorId.get(armazenamentoId);
        return armazenamento ? [armazenamento] : [];
      },
    );

    const consumoArmazenamentosWatts = armazenamentosDaMontagem.reduce(
      (total, armazenamento) => {
        const consumo = armazenamento.especificacaoArmazenamento?.consumoWatts;

        if (consumo === null || consumo === undefined) {
          alertas.push(
            `O armazenamento ${armazenamento.nome} não possui consumo cadastrado.`,
          );

          return total;
        }

        return total + consumo;
      },
      0,
    );

    const ventoinhasPorId = new Map(
      ventoinhas.map((ventoinha) => [ventoinha.id, ventoinha]),
    );

    const consumoVentoinhasWatts = (dados.ventoinhas ?? []).reduce(
      (total, item) => {
        const ventoinha = ventoinhasPorId.get(item.ventoinhaId);
        const especificacao = ventoinha?.especificacaoVentoinha;

        if (
          !ventoinha ||
          !especificacao ||
          especificacao.tensaoVolts === null ||
          especificacao.correnteAmperes === null
        ) {
          alertas.push(
            `Não foi possível calcular o consumo da ventoinha ID ${item.ventoinhaId}.`,
          );

          return total;
        }

        const consumoUnitario =
          especificacao.tensaoVolts * especificacao.correnteAmperes;

        return total + consumoUnitario * item.quantidade;
      },
      0,
    );

    const consumoBombaWatts =
      cooler?.especificacaoCooler?.consumoBombaWatts ?? 0;

    if (
      dados.coolerId !== undefined &&
      cooler?.especificacaoCooler?.tipo === 'WATER_COOLER' &&
      cooler.especificacaoCooler.consumoBombaWatts === null
    ) {
      alertas.push('A bomba do water cooler não possui consumo cadastrado.');
    }

    const consumoBaseSistemaWatts = 50;

    const consumoEstimadoWatts = Math.ceil(
      consumoProcessadorWatts +
        consumoPlacaVideoWatts +
        consumoArmazenamentosWatts +
        consumoVentoinhasWatts +
        consumoBombaWatts +
        consumoBaseSistemaWatts,
    );

    const potenciaFonteWatts = fonte.especificacaoFonte.potenciaWatts;
    const folgaFonteWatts = potenciaFonteWatts - consumoEstimadoWatts;

    const percentualUsoFonte = Number(
      ((consumoEstimadoWatts / potenciaFonteWatts) * 100).toFixed(2),
    );

    const potenciaRecomendadaWatts =
      Math.ceil((consumoEstimadoWatts * 1.25) / 50) * 50;

    if (folgaFonteWatts < 0) {
      erros.push(
        'A potência da fonte é inferior ao consumo estimado da montagem.',
      );
    } else if (potenciaFonteWatts < potenciaRecomendadaWatts) {
      alertas.push(
        'A fonte possui pouca margem de segurança para picos de consumo e futuras expansões.',
      );
    }

    return {
      compativel: erros.length === 0,
      status: erros.length === 0 ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      alertas,
      consumoEstimadoWatts,
      potenciaFonteWatts,
      folgaFonteWatts,
      percentualUsoFonte,
      potenciaRecomendadaWatts,
      componentes: {
        processadorWatts: consumoProcessadorWatts,
        placaVideoWatts: consumoPlacaVideoWatts,
        armazenamentosWatts: Number(consumoArmazenamentosWatts.toFixed(2)),
        ventoinhasWatts: Number(consumoVentoinhasWatts.toFixed(2)),
        bombaWaterCoolerWatts: consumoBombaWatts,
        baseSistemaWatts: consumoBaseSistemaWatts,
      },
      metodologia:
        'Estimativa baseada no TDP do processador, consumo cadastrado da GPU, armazenamentos, ventoinhas, bomba e uma reserva base de 50 W para placa-mãe, memória e periféricos internos.',
    };
  }

  /**
   * Verifica se os slots físicos da placa-mãe e da fonte são suficientes
   * para o número real de módulos/dispositivos na montagem.
   *
   * Valida:
   * - Slots de memória RAM (placa-mãe vs quantidadeModulosRam)
   * - Portas SATA (placa-mãe vs SSDs SATA na montagem)
   * - Conectores SATA da fonte vs SSDs SATA
   * - Slots M.2 disponíveis vs NVMes/M.2 SATA na montagem
   */
  private async verificarMultiplicidadeSlots(
    dados: VerificarCompatibilidadeMontagemDto,
  ) {
    const erros: string[] = [];
    const alertas: string[] = [];

    const [placaMae, fonte, gabinete] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: dados.placaMaeId },
        include: {
          especificacaoPlacaMae: {
            include: { slotsM2: { where: { ativo: true } } },
          },
        },
      }),
      this.prisma.hardware.findUnique({
        where: { id: dados.fonteId },
        include: { especificacaoFonte: true },
      }),
      this.prisma.hardware.findUnique({
        where: { id: dados.gabineteId },
        include: { especificacaoGabinete: true },
      }),
    ]);

    const placaVideo =
      dados.placaVideoId !== undefined
        ? await this.prisma.hardware.findUnique({
            where: { id: dados.placaVideoId },
            include: { especificacaoPlacaVideo: true },
          })
        : null;

    const espPlaca = placaMae?.especificacaoPlacaMae;
    const espFonte = fonte?.especificacaoFonte;
    const espGabinete = gabinete?.especificacaoGabinete;

    const quantidadeModulosRamFisicos =
      dados.quantidadeModulosRamTotal ?? dados.quantidadeModulosRam;

    if (espPlaca && quantidadeModulosRamFisicos !== undefined) {
      const slotsDisponiveis = espPlaca.slotsMemoria;
      const modulosNaMontagem = quantidadeModulosRamFisicos;

      if (modulosNaMontagem > slotsDisponiveis) {
        erros.push(
          `A placa-mãe possui apenas ${slotsDisponiveis} slot(s) de memória, mas a montagem utiliza ${modulosNaMontagem} módulo(s).`,
        );
      } else if (modulosNaMontagem === slotsDisponiveis) {
        alertas.push(
          `Todos os ${slotsDisponiveis} slot(s) de memória da placa-mãe estão ocupados — upgrades futuros exigirão substituição.`,
        );
      }
    }

    let sataFisicos = 0;
    let m2Total = 0;
    let baias25Usadas = 0;
    let baias35Usadas = 0;
    let placasPcieArmazenamento = 0;

    if ((dados.armazenamentoIds ?? []).length > 0 && espPlaca) {
      const armazenamentos = await this.prisma.hardware.findMany({
        where: { id: { in: dados.armazenamentoIds } },
        include: { especificacaoArmazenamento: true },
      });

      const especificacoesPorHardwareId = new Map(
        armazenamentos.map((armazenamento) => [
          armazenamento.id,
          armazenamento.especificacaoArmazenamento,
        ]),
      );

      const espArms = (dados.armazenamentoIds ?? []).flatMap(
        (armazenamentoId) => {
          const especificacao =
            especificacoesPorHardwareId.get(armazenamentoId);
          return especificacao ? [especificacao] : [];
        },
      );

      sataFisicos = espArms.filter(
        (e) =>
          e.interface === InterfaceArmazenamento.SATA &&
          e.formato !== FormatoArmazenamento.M2,
      ).length;

      m2Total = espArms.filter(
        (e) => e.formato === FormatoArmazenamento.M2,
      ).length;

      baias25Usadas = espArms.filter(
        (e) => e.formato === FormatoArmazenamento.POLEGADAS_2_5,
      ).length;

      baias35Usadas = espArms.filter(
        (e) => e.formato === FormatoArmazenamento.POLEGADAS_3_5,
      ).length;

      placasPcieArmazenamento = espArms.filter(
        (e) => e.formato === FormatoArmazenamento.PLACA_PCIE,
      ).length;

      if (sataFisicos > 0) {
        if (espPlaca.portasSata < sataFisicos) {
          erros.push(
            `A placa-mãe possui ${espPlaca.portasSata} porta(s) SATA, mas a montagem usa ${sataFisicos} dispositivo(s) SATA.`,
          );
        }

        if (espFonte && espFonte.conectoresSata < sataFisicos) {
          erros.push(
            `A fonte possui ${espFonte.conectoresSata} conector(es) SATA de energia, mas a montagem usa ${sataFisicos} dispositivo(s) SATA.`,
          );
        }
      }

      if (m2Total > 0) {
        const slotsM2Ativos = espPlaca.slotsM2.length;
        if (m2Total > slotsM2Ativos) {
          erros.push(
            `A placa-mãe possui ${slotsM2Ativos} slot(s) M.2, mas a montagem usa ${m2Total} dispositivo(s) M.2.`,
          );
        } else if (m2Total === slotsM2Ativos && slotsM2Ativos > 0) {
          alertas.push(
            `Todos os ${slotsM2Ativos} slot(s) M.2 da placa-mãe estão ocupados.`,
          );
        }

        const slotsComCompartilhamento = espPlaca.slotsM2.filter(
          (slot) => slot.compartilhaCom,
        );
        if (slotsComCompartilhamento.length > 0 && sataFisicos > 0) {
          alertas.push(
            'Alguns slots M.2 da placa-mãe compartilham recursos com portas SATA e podem desabilitar conectores SATA ao serem utilizados.',
          );
        }
      }
    }

    if (espGabinete) {
      if (baias25Usadas > espGabinete.baias25) {
        erros.push(
          `O gabinete possui ${espGabinete.baias25} baia(s) de 2,5 polegadas, mas a montagem usa ${baias25Usadas}.`,
        );
      }

      if (baias35Usadas > espGabinete.baias35) {
        erros.push(
          `O gabinete possui ${espGabinete.baias35} baia(s) de 3,5 polegadas, mas a montagem usa ${baias35Usadas}.`,
        );
      }

      const slotsGpu = Math.ceil(
        placaVideo?.especificacaoPlacaVideo?.slotsOcupados ?? 0,
      );
      const slotsTraseirosNecessarios = slotsGpu + placasPcieArmazenamento;

      if (slotsTraseirosNecessarios > 0) {
        if (espGabinete.slotsTraseiros === null) {
          alertas.push(
            'Não foi possível confirmar a ocupação total dos slots traseiros do gabinete.',
          );
        } else if (slotsTraseirosNecessarios > espGabinete.slotsTraseiros) {
          erros.push(
            `A montagem precisa de ${slotsTraseirosNecessarios} slot(s) traseiro(s), mas o gabinete possui ${espGabinete.slotsTraseiros}.`,
          );
        }
      }
    }

    const compativel = erros.length === 0;
    return {
      compativel,
      status: compativel ? 'COMPATIVEL' : 'INCOMPATIVEL',
      erros,
      alertas,
      resumo: {
        slotsRamDisponiveis: espPlaca?.slotsMemoria ?? null,
        modulosRamNaMontagem: quantidadeModulosRamFisicos ?? null,
        portasSataDisponiveis: espPlaca?.portasSata ?? null,
        slotsM2Disponiveis: espPlaca?.slotsM2.length ?? null,
        qtdArmazenamentosNaMontagem: (dados.armazenamentoIds ?? []).length,
        conectoresSataFonte: espFonte?.conectoresSata ?? null,
        baias25Disponiveis: espGabinete?.baias25 ?? null,
        baias25Usadas,
        baias35Disponiveis: espGabinete?.baias35 ?? null,
        baias35Usadas,
        slotsTraseirosDisponiveis: espGabinete?.slotsTraseiros ?? null,
        placasPcieArmazenamento,
      },
    };
  }

  async verificarCompatibilidadeMontagem(
    dados: VerificarCompatibilidadeMontagemDto,
  ) {
    const resultados: Array<{
      etapa: string;
      compativel: boolean;
      confirmado: boolean;
      erros: string[];
      alertas: string[];
      detalhes: unknown;
    }> = [];

    const adicionarResultado = (
      etapa: string,
      resultado: {
        compativel: boolean | null;
        erros?: string[];
        alertas?: string[];
        motivo?: string;
      },
    ) => {
      const errosResultado = [...(resultado.erros ?? [])];

      if (
        resultado.compativel === false &&
        errosResultado.length === 0 &&
        resultado.motivo
      ) {
        errosResultado.push(resultado.motivo);
      }

      const alertasResultado = [...(resultado.alertas ?? [])];

      if (resultado.compativel === null) {
        alertasResultado.push(
          'Não foi possível determinar completamente esta compatibilidade.',
        );
      }

      resultados.push({
        etapa,
        compativel: resultado.compativel !== false,
        confirmado: resultado.compativel !== null,
        erros: errosResultado,
        alertas: alertasResultado,
        detalhes: resultado,
      });
    };

    adicionarResultado(
      'CONJUNTO_PRINCIPAL',
      await this.verificarCompatibilidadeConjuntoPrincipal(
        dados.placaMaeId,
        dados.processadorId,
        dados.memoriaRamId,
        dados.quantidadeModulosRam,
      ),
    );

    adicionarResultado(
      'SAIDA_VIDEO',
      await this.verificarSaidaVideoMontagem(
        dados.placaMaeId,
        dados.processadorId,
        dados.placaVideoId,
      ),
    );

    adicionarResultado(
      'PLACA_MAE_GABINETE',
      await this.verificarCompatibilidadePlacaMaeGabinete(
        dados.gabineteId,
        dados.placaMaeId,
      ),
    );

    adicionarResultado(
      'FONTE_GABINETE',
      await this.verificarCompatibilidadeFonteGabinete(
        dados.gabineteId,
        dados.fonteId,
      ),
    );

    adicionarResultado(
      'ALIMENTACAO_PRINCIPAL_FONTE',
      await this.verificarAlimentacaoPrincipalFonte(dados.fonteId),
    );

    if (dados.placaVideoId !== undefined) {
      adicionarResultado(
        'PLACA_VIDEO_GABINETE',
        await this.verificarCompatibilidadePlacaVideoGabinete(
          dados.gabineteId,
          dados.placaVideoId,
        ),
      );

      adicionarResultado(
        'PLACA_VIDEO_FONTE',
        await this.verificarCompatibilidadePlacaVideoFonte(
          dados.fonteId,
          dados.placaVideoId,
        ),
      );
    }

    if (dados.coolerId !== undefined) {
      adicionarResultado(
        'COOLER_PROCESSADOR_GABINETE',
        await this.verificarCompatibilidadeCoolerProcessadorGabinete(
          dados.gabineteId,
          dados.processadorId,
          dados.coolerId,
          dados.memoriaRamId,
        ),
      );
    }

    for (const armazenamentoId of dados.armazenamentoIds ?? []) {
      adicionarResultado(
        `ARMAZENAMENTO_PLACA_MAE_${armazenamentoId}`,
        await this.verificarCompatibilidadeArmazenamentoPlacaMae(
          dados.placaMaeId,
          armazenamentoId,
        ),
      );

      adicionarResultado(
        `ARMAZENAMENTO_GABINETE_${armazenamentoId}`,
        await this.verificarCompatibilidadeArmazenamentoGabinete(
          dados.gabineteId,
          armazenamentoId,
        ),
      );
    }

    for (const ventoinha of dados.ventoinhas ?? []) {
      adicionarResultado(
        `VENTOINHA_GABINETE_${ventoinha.ventoinhaId}_${ventoinha.posicao}`,
        await this.verificarCompatibilidadeVentoinhaGabinete(
          dados.gabineteId,
          ventoinha.ventoinhaId,
          ventoinha.posicao,
          ventoinha.quantidade,
        ),
      );
    }

    if ((dados.ventoinhas ?? []).length > 0) {
      adicionarResultado(
        'OCUPACAO_VENTOINHAS_GABINETE',
        await this.verificarOcupacaoVentoinhasMontagem(dados),
      );
    }

    // ── Verificação de multiplicidade de slots ──────────────────────────────
    adicionarResultado(
      'MULTIPLICIDADE_SLOTS',
      await this.verificarMultiplicidadeSlots(dados),
    );

    const consumoEnergia = await this.calcularConsumoEstimadoMontagem(dados);

    adicionarResultado('CONSUMO_FONTE', consumoEnergia);

    const fluxoAr = await this.calcularFluxoArMontagem(dados);

    adicionarResultado('FLUXO_AR', fluxoAr);

    const erros = resultados.flatMap((resultado) =>
      resultado.erros.map((mensagem) => ({
        etapa: resultado.etapa,
        mensagem,
      })),
    );

    const alertas = resultados.flatMap((resultado) =>
      resultado.alertas.map((mensagem) => ({
        etapa: resultado.etapa,
        mensagem,
      })),
    );

    const compativel = erros.length === 0;
    const totalNaoConfirmados = resultados.filter(
      (resultado) => !resultado.confirmado,
    ).length;

    const status = !compativel
      ? 'INCOMPATIVEL'
      : alertas.length > 0 || totalNaoConfirmados > 0
        ? 'COMPATIVEL_COM_ALERTAS'
        : 'COMPATIVEL';

    return {
      compativel,
      status,
      confirmado: totalNaoConfirmados === 0,
      resumo: {
        totalVerificacoes: resultados.length,
        totalErros: erros.length,
        totalAlertas: alertas.length,
        totalNaoConfirmados,
      },
      erros,
      alertas,
      consumoEnergia,
      fluxoAr,
      resultados,
    };
  }
  statusStorageModelos3D() {
    return this.r2StorageService.status();
  }

  testarConexaoStorageModelos3D() {
    return this.r2StorageService.testarConexao();
  }

  async uploadModelo3DHardware(
    hardwareId: number,
    arquivo: { originalname: string; size: number; buffer: Buffer } | undefined,
    dados: UploadModelo3DHardwareDto,
  ) {
    const hardware = await this.prisma.hardware.findUnique({
      where: { id: hardwareId },
      select: {
        id: true,
        nome: true,
        categoria: true,
      },
    });

    if (!hardware) {
      throw new NotFoundException('Hardware não encontrado.');
    }

    if (!this.categoriaParticipaMontagem3D(hardware.categoria)) {
      throw new BadRequestException(
        `A categoria ${hardware.categoria} não participa da montagem física do PC e não pode receber modelo 3D do montador.`,
      );
    }

    if (!arquivo) {
      throw new BadRequestException(
        'Envie um arquivo .glb no campo "arquivo".',
      );
    }

    if (arquivo.size <= 0 || arquivo.size > 60 * 1024 * 1024) {
      throw new BadRequestException(
        'O arquivo GLB precisa ter entre 1 byte e 60 MB.',
      );
    }

    if (!arquivo.originalname.toLowerCase().endsWith('.glb')) {
      throw new BadRequestException('Apenas arquivos .glb são permitidos.');
    }

    if (!this.bufferPareceGlbValido(arquivo.buffer)) {
      throw new BadRequestException(
        'O arquivo enviado não possui um cabeçalho GLB 2.0 válido.',
      );
    }

    const nomeArquivo = this.normalizarNomeArquivoGlb(arquivo.originalname);
    const storageKeyPadrao = `${this.pastaModelo3DPorCategoria(hardware.categoria)}/${nomeArquivo}`;
    const storageKey = this.r2StorageService.normalizarStorageKey(
      dados.storageKey?.trim() || storageKeyPadrao,
    );
    const resultadoUpload = await this.r2StorageService.uploadGlb(
      storageKey,
      arquivo.buffer,
    );

    try {
      return await this.prisma.modelo3DHardware.create({
        data: {
          hardwareId,
          nome: dados.nome?.trim() || nomeArquivo.replace(/\.glb$/i, ''),
          arquivoUrl: resultadoUpload.arquivoUrl,
          formato: FormatoModelo3D.GLB,
          origem: OrigemModelo3D.PROPRIO,
          storageKey: resultadoUpload.storageKey,
          autor: dados.autor?.trim() || undefined,
          licenca: dados.licenca?.trim() || undefined,
          versao: dados.versao?.trim() || undefined,
          tamanhoBytes: resultadoUpload.tamanhoBytes,
          ativo: true,
          aprovado: false,
        },
        include: {
          hardware: {
            select: {
              id: true,
              nome: true,
              categoria: true,
            },
          },
        },
      });
    } catch (erro) {
      try {
        await this.r2StorageService.removerObjeto(resultadoUpload.storageKey);
      } catch {
        // Evita esconder o erro principal do banco. Um eventual órfão no R2
        // pode ser removido posteriormente pelo administrador.
      }
      throw erro;
    }
  }

  private bufferPareceGlbValido(buffer: Buffer): boolean {
    if (buffer.byteLength < 12) {
      return false;
    }

    const magic = buffer.toString('ascii', 0, 4);
    const versao = buffer.readUInt32LE(4);
    const tamanhoDeclarado = buffer.readUInt32LE(8);

    return (
      magic === 'glTF' && versao === 2 && tamanhoDeclarado === buffer.length
    );
  }

  private normalizarNomeArquivoGlb(nomeOriginal: string): string {
    const nomeBase = nomeOriginal
      .split(/[\\/]/)
      .pop()
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 170);

    if (!nomeBase || !nomeBase.toLowerCase().endsWith('.glb')) {
      throw new BadRequestException('O nome do arquivo GLB é inválido.');
    }

    return nomeBase;
  }

  private pastaModelo3DPorCategoria(categoria: CategoriaHardware): string {
    const pastas: Partial<Record<CategoriaHardware, string>> = {
      [CategoriaHardware.PROCESSADOR]: 'modelos/cpu',
      [CategoriaHardware.COOLER]: 'modelos/cooler',
      [CategoriaHardware.PLACA_MAE]: 'modelos/placaMae',
      [CategoriaHardware.MEMORIA_RAM]: 'modelos/ram',
      [CategoriaHardware.PLACA_VIDEO]: 'modelos/gpu',
      [CategoriaHardware.ARMAZENAMENTO]: 'modelos/sdd_hd',
      [CategoriaHardware.FONTE]: 'modelos/fonte',
      [CategoriaHardware.GABINETE]: 'modelos/gabinete',
      [CategoriaHardware.VENTOINHA]: 'modelos/fan',
    };
    const pasta = pastas[categoria];

    if (!pasta) {
      throw new BadRequestException(
        `Não há pasta R2 configurada para a categoria ${categoria}.`,
      );
    }

    return pasta;
  }

  async criarModelo3DHardware(
    hardwareId: number,
    dados: CriarModelo3DHardwareDto,
  ) {
    const hardware = await this.prisma.hardware.findUnique({
      where: {
        id: hardwareId,
      },
      select: {
        id: true,
        nome: true,
        categoria: true,
      },
    });

    if (!hardware) {
      throw new NotFoundException('Hardware não encontrado.');
    }

    if (!this.categoriaParticipaMontagem3D(hardware.categoria)) {
      throw new BadRequestException(
        `A categoria ${hardware.categoria} não participa da montagem física do PC e não pode receber modelo 3D do montador.`,
      );
    }

    return this.prisma.modelo3DHardware.create({
      data: {
        hardwareId,
        nome: dados.nome,
        arquivoUrl: dados.arquivoUrl,
        formato: dados.formato,
        origem: dados.origem,
        storageKey: dados.storageKey,
        fonteUrl: dados.fonteUrl,
        autor: dados.autor,
        licenca: dados.licenca,
        versao: dados.versao,
        alturaRealMm: dados.alturaRealMm,
        larguraRealMm: dados.larguraRealMm,
        profundidadeRealMm: dados.profundidadeRealMm,
        tamanhoBytes: dados.tamanhoBytes,
        posicaoCorrecaoX: dados.posicaoCorrecaoX ?? 0,
        posicaoCorrecaoY: dados.posicaoCorrecaoY ?? 0,
        posicaoCorrecaoZ: dados.posicaoCorrecaoZ ?? 0,
        rotacaoCorrecaoX: dados.rotacaoCorrecaoX ?? 0,
        rotacaoCorrecaoY: dados.rotacaoCorrecaoY ?? 0,
        rotacaoCorrecaoZ: dados.rotacaoCorrecaoZ ?? 0,
        escalaCorrecaoX: dados.escalaCorrecaoX ?? 1,
        escalaCorrecaoY: dados.escalaCorrecaoY ?? 1,
        escalaCorrecaoZ: dados.escalaCorrecaoZ ?? 1,
        ativo: dados.ativo ?? true,
        aprovado: false,
      },
      include: {
        hardware: {
          select: {
            id: true,
            nome: true,
            categoria: true,
          },
        },
      },
    });
  }
  async listarModelos3DHardwareAdmin(hardwareId: number) {
    const hardware = await this.prisma.hardware.findUnique({
      where: {
        id: hardwareId,
      },
      select: {
        id: true,
        nome: true,
        categoria: true,
      },
    });

    if (!hardware) {
      throw new NotFoundException('Hardware não encontrado.');
    }

    const modelos = await this.prisma.modelo3DHardware.findMany({
      where: {
        hardwareId,
      },
      orderBy: [
        {
          ativo: 'desc',
        },
        {
          aprovado: 'desc',
        },
        {
          criadoEm: 'desc',
        },
      ],
    });

    return {
      hardware,
      total: modelos.length,
      modelos,
    };
  }
  async aprovarModelo3DHardware(modeloId: number) {
    const modelo = await this.prisma.modelo3DHardware.findUnique({
      where: {
        id: modeloId,
      },
    });

    if (!modelo) {
      throw new NotFoundException('Modelo 3D não encontrado.');
    }

    return this.prisma.modelo3DHardware.update({
      where: {
        id: modeloId,
      },
      data: {
        aprovado: true,
      },
      include: {
        hardware: {
          select: {
            id: true,
            nome: true,
            categoria: true,
          },
        },
      },
    });
  }
  async listarModelos3DHardwarePublico(hardwareId: number) {
    const hardware = await this.prisma.hardware.findFirst({
      where: {
        id: hardwareId,
        ativo: true,
        publicado: true,
      },
      select: {
        id: true,
        nome: true,
        categoria: true,
      },
    });

    if (!hardware) {
      throw new NotFoundException('Hardware não encontrado ou não publicado.');
    }

    const modelos = await this.prisma.modelo3DHardware.findMany({
      where: {
        hardwareId,
        ativo: true,
        aprovado: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });

    return {
      hardware,
      total: modelos.length,
      modelos,
    };
  }
  async atualizarStatusModelo3DHardware(
    modeloId: number,
    dados: AtualizarStatusModelo3DDto,
  ) {
    const modelo = await this.prisma.modelo3DHardware.findUnique({
      where: {
        id: modeloId,
      },
    });

    if (!modelo) {
      throw new NotFoundException('Modelo 3D não encontrado.');
    }

    return this.prisma.modelo3DHardware.update({
      where: {
        id: modeloId,
      },
      data: {
        ativo: dados.ativo,
      },
      include: {
        hardware: {
          select: {
            id: true,
            nome: true,
            categoria: true,
          },
        },
      },
    });
  }

  async atualizarModelo3DHardware(
    modeloId: number,
    dados: AtualizarModelo3DHardwareDto,
  ) {
    const modelo = await this.prisma.modelo3DHardware.findUnique({
      where: {
        id: modeloId,
      },
    });

    if (!modelo) {
      throw new NotFoundException('Modelo 3D não encontrado.');
    }

    return this.prisma.modelo3DHardware.update({
      where: {
        id: modeloId,
      },
      data: {
        nome: dados.nome,
        arquivoUrl: dados.arquivoUrl,
        formato: dados.formato,
        origem: dados.origem,
        storageKey: dados.storageKey,
        fonteUrl: dados.fonteUrl,
        autor: dados.autor,
        licenca: dados.licenca,
        versao: dados.versao,
        alturaRealMm: dados.alturaRealMm,
        larguraRealMm: dados.larguraRealMm,
        profundidadeRealMm: dados.profundidadeRealMm,
        tamanhoBytes: dados.tamanhoBytes,
        posicaoCorrecaoX: dados.posicaoCorrecaoX,
        posicaoCorrecaoY: dados.posicaoCorrecaoY,
        posicaoCorrecaoZ: dados.posicaoCorrecaoZ,
        rotacaoCorrecaoX: dados.rotacaoCorrecaoX,
        rotacaoCorrecaoY: dados.rotacaoCorrecaoY,
        rotacaoCorrecaoZ: dados.rotacaoCorrecaoZ,
        escalaCorrecaoX: dados.escalaCorrecaoX,
        escalaCorrecaoY: dados.escalaCorrecaoY,
        escalaCorrecaoZ: dados.escalaCorrecaoZ,
      },
      include: {
        hardware: {
          select: {
            id: true,
            nome: true,
            categoria: true,
          },
        },
      },
    });
  }

  async removerModelo3DHardwarePermanentemente(modeloId: number) {
    const modelo = await this.prisma.modelo3DHardware.findUnique({
      where: { id: modeloId },
      select: {
        id: true,
        hardwareId: true,
        nome: true,
        arquivoUrl: true,
        storageKey: true,
        origem: true,
      },
    });

    if (!modelo) {
      throw new NotFoundException('Modelo 3D não encontrado.');
    }

    const arquivoR2Gerenciado = this.r2StorageService.ehArquivoGerenciado(
      modelo.storageKey,
      modelo.arquivoUrl,
    );

    // Remove primeiro a referência do banco. Se o R2 falhar depois, sobra apenas
    // um objeto órfão sem impacto no montador; nunca deixamos o banco apontando
    // para um arquivo que já foi apagado.
    await this.prisma.modelo3DHardware.delete({
      where: { id: modeloId },
    });

    let arquivoR2Removido = false;
    let aviso: string | null = null;

    if (arquivoR2Gerenciado && modelo.storageKey) {
      try {
        await this.r2StorageService.removerObjeto(modelo.storageKey);
        arquivoR2Removido = true;
      } catch {
        aviso =
          'O registro foi removido do banco, mas o arquivo não pôde ser apagado do Cloudflare R2. Remova o objeto manualmente depois.';
      }
    }

    return {
      removido: true,
      modeloId: modelo.id,
      hardwareId: modelo.hardwareId,
      nome: modelo.nome,
      origem: modelo.origem,
      storageKey: modelo.storageKey,
      arquivoR2Gerenciado,
      arquivoR2Removido,
      aviso,
    };
  }

  async criarPontoEncaixeHardware(
    hardwarePaiId: number,
    dados: CriarPontoEncaixeHardwareDto,
  ) {
    const hardwarePai = await this.prisma.hardware.findUnique({
      where: {
        id: hardwarePaiId,
      },
      select: {
        id: true,
        nome: true,
        categoria: true,
      },
    });

    if (!hardwarePai) {
      throw new NotFoundException('Hardware pai não encontrado.');
    }

    if (!this.categoriaParticipaMontagem3D(hardwarePai.categoria)) {
      throw new BadRequestException(
        `A categoria ${hardwarePai.categoria} não participa da montagem física do PC e não pode possuir pontos de encaixe do montador.`,
      );
    }

    if (!this.categoriaParticipaMontagem3D(dados.categoriaAceita)) {
      throw new BadRequestException(
        `A categoria ${dados.categoriaAceita} não participa da montagem física do PC e não pode ser usada como categoria de encaixe.`,
      );
    }

    const pontoExistente = await this.prisma.pontoEncaixeHardware.findUnique({
      where: {
        hardwarePaiId_codigo: {
          hardwarePaiId,
          codigo: dados.codigo,
        },
      },
    });

    if (pontoExistente) {
      throw new ConflictException(
        'Já existe um ponto de encaixe com este código neste hardware.',
      );
    }

    return this.prisma.pontoEncaixeHardware.create({
      data: {
        hardwarePaiId,
        codigo: dados.codigo,
        nome: dados.nome,
        categoriaAceita: dados.categoriaAceita,
        posicaoX: dados.posicaoX ?? 0,
        posicaoY: dados.posicaoY ?? 0,
        posicaoZ: dados.posicaoZ ?? 0,
        rotacaoX: dados.rotacaoX ?? 0,
        rotacaoY: dados.rotacaoY ?? 0,
        rotacaoZ: dados.rotacaoZ ?? 0,
        escalaX: dados.escalaX ?? 1,
        escalaY: dados.escalaY ?? 1,
        escalaZ: dados.escalaZ ?? 1,
        ordem: dados.ordem ?? 0,
        obrigatorio: dados.obrigatorio ?? false,
        ativo: dados.ativo ?? true,
        observacao: dados.observacao,
      },
      include: {
        hardwarePai: {
          select: {
            id: true,
            nome: true,
            categoria: true,
          },
        },
      },
    });
  }
  async listarPontosEncaixeHardwareAdmin(hardwarePaiId: number) {
    const hardwarePai = await this.prisma.hardware.findUnique({
      where: {
        id: hardwarePaiId,
      },
      select: {
        id: true,
        nome: true,
        categoria: true,
      },
    });

    if (!hardwarePai) {
      throw new NotFoundException('Hardware pai não encontrado.');
    }

    const pontosEncaixe = await this.prisma.pontoEncaixeHardware.findMany({
      where: {
        hardwarePaiId,
      },
      include: {
        ajustesEspecificos: {
          include: {
            hardwareFilho: {
              select: {
                id: true,
                nome: true,
                categoria: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
      orderBy: [
        {
          ordem: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });

    return {
      hardwarePai,
      total: pontosEncaixe.length,
      pontosEncaixe,
    };
  }
  async criarAjusteEncaixeHardware(
    pontoEncaixeId: number,
    dados: CriarAjusteEncaixeHardwareDto,
  ) {
    const [pontoEncaixe, hardwareFilho] = await Promise.all([
      this.prisma.pontoEncaixeHardware.findUnique({
        where: {
          id: pontoEncaixeId,
        },
        include: {
          hardwarePai: {
            select: {
              id: true,
              nome: true,
              categoria: true,
            },
          },
        },
      }),

      this.prisma.hardware.findUnique({
        where: {
          id: dados.hardwareFilhoId,
        },
        select: {
          id: true,
          nome: true,
          categoria: true,
        },
      }),
    ]);

    if (!pontoEncaixe) {
      throw new NotFoundException('Ponto de encaixe não encontrado.');
    }

    if (!hardwareFilho) {
      throw new NotFoundException('Hardware filho não encontrado.');
    }

    if (hardwareFilho.categoria !== pontoEncaixe.categoriaAceita) {
      throw new BadRequestException(
        `Este ponto aceita somente hardwares da categoria ${pontoEncaixe.categoriaAceita}.`,
      );
    }

    const ajusteExistente = await this.prisma.ajusteEncaixeHardware.findUnique({
      where: {
        pontoEncaixeId_hardwareFilhoId: {
          pontoEncaixeId,
          hardwareFilhoId: dados.hardwareFilhoId,
        },
      },
    });

    if (ajusteExistente) {
      throw new ConflictException(
        'Já existe um ajuste para este hardware neste ponto de encaixe.',
      );
    }

    return this.prisma.ajusteEncaixeHardware.create({
      data: {
        pontoEncaixeId,
        hardwareFilhoId: dados.hardwareFilhoId,
        posicaoX: dados.posicaoX ?? 0,
        posicaoY: dados.posicaoY ?? 0,
        posicaoZ: dados.posicaoZ ?? 0,
        rotacaoX: dados.rotacaoX ?? 0,
        rotacaoY: dados.rotacaoY ?? 0,
        rotacaoZ: dados.rotacaoZ ?? 0,
        escalaX: dados.escalaX ?? 1,
        escalaY: dados.escalaY ?? 1,
        escalaZ: dados.escalaZ ?? 1,
        observacao: dados.observacao,
        revisado: dados.revisado ?? false,
      },
      include: {
        pontoEncaixe: {
          include: {
            hardwarePai: {
              select: {
                id: true,
                nome: true,
                categoria: true,
              },
            },
          },
        },
        hardwareFilho: {
          select: {
            id: true,
            nome: true,
            categoria: true,
          },
        },
      },
    });
  }
  async listarPontosEncaixeHardwarePublico(hardwarePaiId: number) {
    const hardwarePai = await this.prisma.hardware.findFirst({
      where: {
        id: hardwarePaiId,
        ativo: true,
        publicado: true,
      },
      select: {
        id: true,
        nome: true,
        categoria: true,
      },
    });

    if (!hardwarePai) {
      throw new NotFoundException(
        'Hardware pai não encontrado ou não publicado.',
      );
    }

    const pontosEncaixe = await this.prisma.pontoEncaixeHardware.findMany({
      where: {
        hardwarePaiId,
        ativo: true,
      },
      include: {
        ajustesEspecificos: {
          where: {
            revisado: true,
          },
          include: {
            hardwareFilho: {
              select: {
                id: true,
                nome: true,
                categoria: true,
                ativo: true,
                publicado: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
      orderBy: [
        {
          ordem: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });

    const pontosPublicos = pontosEncaixe.map((ponto) => ({
      ...ponto,
      ajustesEspecificos: ponto.ajustesEspecificos
        .filter(
          (ajuste) =>
            ajuste.hardwareFilho.ativo && ajuste.hardwareFilho.publicado,
        )
        .map((ajuste) => ({
          ...ajuste,
          hardwareFilho: {
            id: ajuste.hardwareFilho.id,
            nome: ajuste.hardwareFilho.nome,
            categoria: ajuste.hardwareFilho.categoria,
          },
        })),
    }));

    return {
      hardwarePai,
      total: pontosPublicos.length,
      pontosEncaixe: pontosPublicos,
    };
  }
  async atualizarPontoEncaixeHardware(
    pontoEncaixeId: number,
    dados: AtualizarPontoEncaixeHardwareDto,
  ) {
    const pontoEncaixe = await this.prisma.pontoEncaixeHardware.findUnique({
      where: {
        id: pontoEncaixeId,
      },
    });

    if (!pontoEncaixe) {
      throw new NotFoundException('Ponto de encaixe não encontrado.');
    }

    if (dados.codigo !== undefined && dados.codigo !== pontoEncaixe.codigo) {
      const codigoExistente = await this.prisma.pontoEncaixeHardware.findUnique(
        {
          where: {
            hardwarePaiId_codigo: {
              hardwarePaiId: pontoEncaixe.hardwarePaiId,
              codigo: dados.codigo,
            },
          },
        },
      );

      if (codigoExistente) {
        throw new ConflictException(
          'Já existe um ponto de encaixe com este código neste hardware.',
        );
      }
    }

    return this.prisma.pontoEncaixeHardware.update({
      where: {
        id: pontoEncaixeId,
      },
      data: {
        codigo: dados.codigo,
        nome: dados.nome,
        categoriaAceita: dados.categoriaAceita,
        posicaoX: dados.posicaoX,
        posicaoY: dados.posicaoY,
        posicaoZ: dados.posicaoZ,
        rotacaoX: dados.rotacaoX,
        rotacaoY: dados.rotacaoY,
        rotacaoZ: dados.rotacaoZ,
        escalaX: dados.escalaX,
        escalaY: dados.escalaY,
        escalaZ: dados.escalaZ,
        ordem: dados.ordem,
        obrigatorio: dados.obrigatorio,
        ativo: dados.ativo,
        observacao: dados.observacao,
      },
      include: {
        hardwarePai: {
          select: {
            id: true,
            nome: true,
            categoria: true,
          },
        },
        ajustesEspecificos: {
          include: {
            hardwareFilho: {
              select: {
                id: true,
                nome: true,
                categoria: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });
  }
  async atualizarAjusteEncaixeHardware(
    ajusteId: number,
    dados: AtualizarAjusteEncaixeHardwareDto,
  ) {
    const ajusteExistente = await this.prisma.ajusteEncaixeHardware.findUnique({
      where: {
        id: ajusteId,
      },
    });

    if (!ajusteExistente) {
      throw new NotFoundException(
        'Ajuste específico de encaixe não encontrado.',
      );
    }

    return this.prisma.ajusteEncaixeHardware.update({
      where: {
        id: ajusteId,
      },
      data: {
        posicaoX: dados.posicaoX,
        posicaoY: dados.posicaoY,
        posicaoZ: dados.posicaoZ,
        rotacaoX: dados.rotacaoX,
        rotacaoY: dados.rotacaoY,
        rotacaoZ: dados.rotacaoZ,
        escalaX: dados.escalaX,
        escalaY: dados.escalaY,
        escalaZ: dados.escalaZ,
        observacao: dados.observacao,
        revisado: dados.revisado,
      },
      include: {
        pontoEncaixe: {
          include: {
            hardwarePai: {
              select: {
                id: true,
                nome: true,
                categoria: true,
              },
            },
          },
        },
        hardwareFilho: {
          select: {
            id: true,
            nome: true,
            categoria: true,
          },
        },
      },
    });
  }
  async resolverEncaixeHardwarePublico(
    hardwarePaiId: number,
    pontoEncaixeId: number,
    hardwareFilhoId: number,
  ) {
    const [hardwarePai, hardwareFilho] = await Promise.all([
      this.prisma.hardware.findFirst({
        where: {
          id: hardwarePaiId,
          ativo: true,
          publicado: true,
        },
        select: {
          id: true,
          nome: true,
          categoria: true,
          modelos3D: {
            where: {
              ativo: true,
              aprovado: true,
            },
            orderBy: [
              {
                atualizadoEm: 'desc',
              },
              {
                id: 'desc',
              },
            ],
            take: 1,
            select: {
              id: true,
              nome: true,
              arquivoUrl: true,
              formato: true,
              origem: true,
              storageKey: true,
              fonteUrl: true,
              autor: true,
              licenca: true,
              versao: true,
              alturaRealMm: true,
              larguraRealMm: true,
              profundidadeRealMm: true,
              tamanhoBytes: true,
              posicaoCorrecaoX: true,
              posicaoCorrecaoY: true,
              posicaoCorrecaoZ: true,
              rotacaoCorrecaoX: true,
              rotacaoCorrecaoY: true,
              rotacaoCorrecaoZ: true,
              escalaCorrecaoX: true,
              escalaCorrecaoY: true,
              escalaCorrecaoZ: true,
            },
          },
        },
      }),

      this.prisma.hardware.findFirst({
        where: {
          id: hardwareFilhoId,
          ativo: true,
          publicado: true,
        },
        select: {
          id: true,
          nome: true,
          categoria: true,
          modelos3D: {
            where: {
              ativo: true,
              aprovado: true,
            },
            orderBy: [
              {
                atualizadoEm: 'desc',
              },
              {
                id: 'desc',
              },
            ],
            take: 1,
            select: {
              id: true,
              nome: true,
              arquivoUrl: true,
              formato: true,
              origem: true,
              storageKey: true,
              fonteUrl: true,
              autor: true,
              licenca: true,
              versao: true,
              alturaRealMm: true,
              larguraRealMm: true,
              profundidadeRealMm: true,
              tamanhoBytes: true,
              posicaoCorrecaoX: true,
              posicaoCorrecaoY: true,
              posicaoCorrecaoZ: true,
              rotacaoCorrecaoX: true,
              rotacaoCorrecaoY: true,
              rotacaoCorrecaoZ: true,
              escalaCorrecaoX: true,
              escalaCorrecaoY: true,
              escalaCorrecaoZ: true,
            },
          },
        },
      }),
    ]);

    if (!hardwarePai) {
      throw new NotFoundException(
        'Hardware pai não encontrado ou não publicado.',
      );
    }

    if (!hardwareFilho) {
      throw new NotFoundException(
        'Hardware filho não encontrado ou não publicado.',
      );
    }
    const modelo3DHardwarePai = hardwarePai.modelos3D[0] ?? null;

    const pontoEncaixe = await this.prisma.pontoEncaixeHardware.findFirst({
      where: {
        id: pontoEncaixeId,
        hardwarePaiId,
        ativo: true,
      },
      include: {
        ajustesEspecificos: {
          where: {
            hardwareFilhoId,
            revisado: true,
          },
          take: 1,
        },
      },
    });

    if (!pontoEncaixe) {
      throw new NotFoundException(
        'Ponto de encaixe ativo não encontrado para este hardware.',
      );
    }

    if (hardwareFilho.categoria !== pontoEncaixe.categoriaAceita) {
      throw new BadRequestException(
        `Este ponto aceita somente hardwares da categoria ${pontoEncaixe.categoriaAceita}.`,
      );
    }

    const ajusteEspecifico = pontoEncaixe.ajustesEspecificos[0] ?? null;

    return {
      hardwarePai: {
        id: hardwarePai.id,
        nome: hardwarePai.nome,
        categoria: hardwarePai.categoria,
        modelo3D: modelo3DHardwarePai,

        transformacaoRenderizacao: {
          posicaoX: modelo3DHardwarePai?.posicaoCorrecaoX ?? 0,
          posicaoY: modelo3DHardwarePai?.posicaoCorrecaoY ?? 0,
          posicaoZ: modelo3DHardwarePai?.posicaoCorrecaoZ ?? 0,

          rotacaoX: modelo3DHardwarePai?.rotacaoCorrecaoX ?? 0,
          rotacaoY: modelo3DHardwarePai?.rotacaoCorrecaoY ?? 0,
          rotacaoZ: modelo3DHardwarePai?.rotacaoCorrecaoZ ?? 0,

          escalaX: modelo3DHardwarePai?.escalaCorrecaoX ?? 1,
          escalaY: modelo3DHardwarePai?.escalaCorrecaoY ?? 1,
          escalaZ: modelo3DHardwarePai?.escalaCorrecaoZ ?? 1,
        },
      },
      hardwareFilho: {
        id: hardwareFilho.id,
        nome: hardwareFilho.nome,
        categoria: hardwareFilho.categoria,
        modelo3D: hardwareFilho.modelos3D[0] ?? null,
      },
      pontoEncaixe: {
        id: pontoEncaixe.id,
        codigo: pontoEncaixe.codigo,
        nome: pontoEncaixe.nome,
        categoriaAceita: pontoEncaixe.categoriaAceita,
      },
      ajusteEspecificoAplicado: ajusteEspecifico !== null,
      ajusteEspecificoId: ajusteEspecifico?.id ?? null,
      transformacaoFinal: {
        posicaoX: pontoEncaixe.posicaoX + (ajusteEspecifico?.posicaoX ?? 0),
        posicaoY: pontoEncaixe.posicaoY + (ajusteEspecifico?.posicaoY ?? 0),
        posicaoZ: pontoEncaixe.posicaoZ + (ajusteEspecifico?.posicaoZ ?? 0),

        rotacaoX: pontoEncaixe.rotacaoX + (ajusteEspecifico?.rotacaoX ?? 0),
        rotacaoY: pontoEncaixe.rotacaoY + (ajusteEspecifico?.rotacaoY ?? 0),
        rotacaoZ: pontoEncaixe.rotacaoZ + (ajusteEspecifico?.rotacaoZ ?? 0),

        escalaX: pontoEncaixe.escalaX * (ajusteEspecifico?.escalaX ?? 1),
        escalaY: pontoEncaixe.escalaY * (ajusteEspecifico?.escalaY ?? 1),
        escalaZ: pontoEncaixe.escalaZ * (ajusteEspecifico?.escalaZ ?? 1),
      },
      transformacaoRenderizacaoFinal: {
        posicaoX:
          pontoEncaixe.posicaoX +
          (ajusteEspecifico?.posicaoX ?? 0) +
          (hardwareFilho.modelos3D[0]?.posicaoCorrecaoX ?? 0),

        posicaoY:
          pontoEncaixe.posicaoY +
          (ajusteEspecifico?.posicaoY ?? 0) +
          (hardwareFilho.modelos3D[0]?.posicaoCorrecaoY ?? 0),

        posicaoZ:
          pontoEncaixe.posicaoZ +
          (ajusteEspecifico?.posicaoZ ?? 0) +
          (hardwareFilho.modelos3D[0]?.posicaoCorrecaoZ ?? 0),

        rotacaoX:
          pontoEncaixe.rotacaoX +
          (ajusteEspecifico?.rotacaoX ?? 0) +
          (hardwareFilho.modelos3D[0]?.rotacaoCorrecaoX ?? 0),

        rotacaoY:
          pontoEncaixe.rotacaoY +
          (ajusteEspecifico?.rotacaoY ?? 0) +
          (hardwareFilho.modelos3D[0]?.rotacaoCorrecaoY ?? 0),

        rotacaoZ:
          pontoEncaixe.rotacaoZ +
          (ajusteEspecifico?.rotacaoZ ?? 0) +
          (hardwareFilho.modelos3D[0]?.rotacaoCorrecaoZ ?? 0),

        escalaX:
          pontoEncaixe.escalaX *
          (ajusteEspecifico?.escalaX ?? 1) *
          (hardwareFilho.modelos3D[0]?.escalaCorrecaoX ?? 1),

        escalaY:
          pontoEncaixe.escalaY *
          (ajusteEspecifico?.escalaY ?? 1) *
          (hardwareFilho.modelos3D[0]?.escalaCorrecaoY ?? 1),

        escalaZ:
          pontoEncaixe.escalaZ *
          (ajusteEspecifico?.escalaZ ?? 1) *
          (hardwareFilho.modelos3D[0]?.escalaCorrecaoZ ?? 1),
      },
    };
  }
  async resolverMontagem3DPublica(
    hardwarePaiId: number,
    dados: ResolverMontagem3DDto,
  ) {
    const hardwarePai = await this.prisma.hardware.findFirst({
      where: {
        id: hardwarePaiId,
        ativo: true,
        publicado: true,
      },
      select: {
        id: true,
        nome: true,
        marca: true,
        modelo: true,
        categoria: true,
        especificacaoGabinete: {
          select: {
            tamanho: true,
            alturaMm: true,
            larguraMm: true,
            profundidadeMm: true,
            baias25: true,
            baias35: true,
            slotsTraseiros: true,
            suportaGpuVertical: true,
            espacoGerenciamentoCabosMm: true,
            suportesFans: {
              select: {
                posicao: true,
                tamanhoMm: true,
                quantidadeMaxima: true,
                espessuraMaximaMm: true,
              },
            },
            suportesRadiador: {
              select: {
                posicao: true,
                tamanhoMm: true,
                espessuraConjuntoMaximaMm: true,
              },
            },
          },
        },
        modelos3D: {
          where: {
            ativo: true,
            aprovado: true,
          },
          orderBy: [
            {
              atualizadoEm: 'desc',
            },
            {
              id: 'desc',
            },
          ],
          take: 1,
          select: {
            id: true,
            nome: true,
            arquivoUrl: true,
            formato: true,
            origem: true,
            storageKey: true,
            fonteUrl: true,
            autor: true,
            licenca: true,
            versao: true,
            alturaRealMm: true,
            larguraRealMm: true,
            profundidadeRealMm: true,
            tamanhoBytes: true,
            posicaoCorrecaoX: true,
            posicaoCorrecaoY: true,
            posicaoCorrecaoZ: true,
            rotacaoCorrecaoX: true,
            rotacaoCorrecaoY: true,
            rotacaoCorrecaoZ: true,
            escalaCorrecaoX: true,
            escalaCorrecaoY: true,
            escalaCorrecaoZ: true,
          },
        },
      },
    });

    if (!hardwarePai) {
      throw new NotFoundException(
        'Hardware pai não encontrado ou não publicado.',
      );
    }

    const modelo3DHardwarePai = hardwarePai.modelos3D[0] ?? null;

    const instanciaRaizId = `hardware-raiz-${hardwarePaiId}`;

    const instanciaRaizInformada = dados.itens.find(
      (item) => item.instanciaId === instanciaRaizId,
    );

    if (instanciaRaizInformada) {
      throw new BadRequestException(
        `O instanciaId "${instanciaRaizId}" é reservado para o hardware principal da montagem e não pode ser usado nos itens.`,
      );
    }

    const itensNormalizados = dados.itens.map((item, indice) => ({
      ...item,
      instanciaId: item.instanciaId ?? `item-${indice + 1}`,
    }));

    const instanciaIdsInformadas = itensNormalizados.map(
      (item) => item.instanciaId,
    );

    const instanciaIdsDuplicadas = instanciaIdsInformadas.filter(
      (instanciaId, indice) =>
        instanciaIdsInformadas.indexOf(instanciaId) !== indice,
    );

    if (instanciaIdsDuplicadas.length > 0) {
      throw new BadRequestException(
        'Cada instância física da montagem deve possuir um instanciaId único.',
      );
    }
    const pontosEncaixeIds = itensNormalizados.map(
      (item) => item.pontoEncaixeId,
    );

    const pontosEncaixeIdsUnicos = [...new Set(pontosEncaixeIds)];

    const pontosEncaixe = await this.prisma.pontoEncaixeHardware.findMany({
      where: {
        id: {
          in: pontosEncaixeIdsUnicos,
        },
        ativo: true,
      },
      select: {
        id: true,
        hardwarePaiId: true,
        codigo: true,
        nome: true,
        obrigatorio: true,
      },
    });

    if (pontosEncaixe.length !== pontosEncaixeIdsUnicos.length) {
      throw new BadRequestException(
        'Um ou mais pontos de encaixe não existem ou estão inativos.',
      );
    }

    const pontosPorId = new Map(
      pontosEncaixe.map((ponto) => [ponto.id, ponto]),
    );

    const itensPorInstanciaId = new Map(
      itensNormalizados.map((item) => [item.instanciaId, item]),
    );

    const itensComPaiResolvido = itensNormalizados.map((item) => {
      const ponto = pontosPorId.get(item.pontoEncaixeId);

      if (!ponto) {
        throw new BadRequestException(
          `Ponto de encaixe ${item.pontoEncaixeId} não encontrado ou inativo.`,
        );
      }

      if (ponto.hardwarePaiId === hardwarePaiId) {
        if (
          item.instanciaPaiId !== undefined &&
          item.instanciaPaiId !== instanciaRaizId
        ) {
          throw new BadRequestException(
            `O ponto ${ponto.codigo} pertence ao hardware principal da montagem.`,
          );
        }

        return {
          ...item,
          instanciaPaiId: instanciaRaizId,
          hardwarePaiDoPontoId: ponto.hardwarePaiId,
        };
      }

      if (item.instanciaPaiId !== undefined) {
        const instanciaPai = itensPorInstanciaId.get(item.instanciaPaiId);

        if (!instanciaPai) {
          throw new BadRequestException(
            `A instância pai ${item.instanciaPaiId} não foi encontrada na montagem.`,
          );
        }

        if (instanciaPai.hardwareFilhoId !== ponto.hardwarePaiId) {
          throw new BadRequestException(
            `A instância ${item.instanciaPaiId} não corresponde ao hardware pai exigido pelo ponto ${ponto.codigo}.`,
          );
        }

        return {
          ...item,
          hardwarePaiDoPontoId: ponto.hardwarePaiId,
        };
      }

      const candidatosPai = itensNormalizados.filter(
        (possivelPai) => possivelPai.hardwareFilhoId === ponto.hardwarePaiId,
      );

      if (candidatosPai.length === 0) {
        throw new BadRequestException(
          `Nenhuma instância do hardware pai ${ponto.hardwarePaiId} foi encontrada para o ponto ${ponto.codigo}.`,
        );
      }

      if (candidatosPai.length > 1) {
        throw new BadRequestException(
          `Há mais de uma instância possível como pai do ponto ${ponto.codigo}. Informe instanciaPaiId.`,
        );
      }

      return {
        ...item,
        instanciaPaiId: candidatosPai[0].instanciaId,
        hardwarePaiDoPontoId: ponto.hardwarePaiId,
      };
    });

    const ocupacoesEncaixe = new Set<string>();

    for (const item of itensComPaiResolvido) {
      if (!item.instanciaPaiId) {
        throw new BadRequestException(
          `Não foi possível determinar a instância pai de ${item.instanciaId}.`,
        );
      }

      const chaveOcupacao = `${item.instanciaPaiId}:${item.pontoEncaixeId}`;

      if (ocupacoesEncaixe.has(chaveOcupacao)) {
        throw new BadRequestException(
          'Não é permitido ocupar o mesmo ponto de encaixe mais de uma vez na mesma instância pai.',
        );
      }

      ocupacoesEncaixe.add(chaveOcupacao);
    }

    let itensPendentes = itensComPaiResolvido.map((item) => {
      const ponto = pontosPorId.get(item.pontoEncaixeId);

      if (!ponto) {
        throw new BadRequestException(
          `Ponto de encaixe ${item.pontoEncaixeId} não encontrado ou inativo.`,
        );
      }

      return {
        item,
        ponto,
      };
    });

    const grafoMontagem = new Map<string, string[]>();

    for (const { item } of itensPendentes) {
      const instanciaPaiId = item.instanciaPaiId;

      if (!instanciaPaiId) {
        throw new BadRequestException(
          `Não foi possível determinar a instância pai de ${item.instanciaId}.`,
        );
      }

      const filhos = grafoMontagem.get(instanciaPaiId) ?? [];

      filhos.push(item.instanciaId);

      grafoMontagem.set(instanciaPaiId, filhos);
    }

    const instanciasVisitando = new Set<string>();
    const instanciasVisitadas = new Set<string>();

    const possuiCiclo = (instanciaId: string): boolean => {
      if (instanciasVisitando.has(instanciaId)) {
        return true;
      }

      if (instanciasVisitadas.has(instanciaId)) {
        return false;
      }

      instanciasVisitando.add(instanciaId);

      const filhos = grafoMontagem.get(instanciaId) ?? [];

      for (const instanciaFilhoId of filhos) {
        if (possuiCiclo(instanciaFilhoId)) {
          return true;
        }
      }

      instanciasVisitando.delete(instanciaId);
      instanciasVisitadas.add(instanciaId);

      return false;
    };

    const todasInstancias = new Set<string>([
      instanciaRaizId,
      ...itensPendentes.map(({ item }) => item.instanciaId),
    ]);

    for (const instanciaId of todasInstancias) {
      if (possuiCiclo(instanciaId)) {
        throw new BadRequestException(
          'A montagem possui uma dependência circular entre as instâncias dos hardwares.',
        );
      }
    }

    const itensOrdenados: typeof itensPendentes = [];

    const instanciasConectadas = new Set<string>([instanciaRaizId]);

    const niveisInstancia = new Map<string, number>([[instanciaRaizId, 0]]);

    while (itensPendentes.length > 0) {
      const itensConectaveis = itensPendentes.filter(
        ({ item }) =>
          item.instanciaPaiId !== undefined &&
          instanciasConectadas.has(item.instanciaPaiId),
      );

      if (itensConectaveis.length === 0) {
        throw new BadRequestException(
          'A montagem possui instâncias que não estão conectadas ao hardware principal.',
        );
      }

      for (const itemConectavel of itensConectaveis) {
        const instanciaPaiId = itemConectavel.item.instanciaPaiId;

        if (!instanciaPaiId) {
          throw new BadRequestException(
            `Não foi possível determinar a instância pai de ${itemConectavel.item.instanciaId}.`,
          );
        }

        if (instanciaPaiId === itemConectavel.item.instanciaId) {
          throw new BadRequestException(
            'Uma instância não pode ser encaixada nela mesma.',
          );
        }

        if (
          itemConectavel.ponto.hardwarePaiId ===
          itemConectavel.item.hardwareFilhoId
        ) {
          throw new BadRequestException(
            'Um hardware não pode ser encaixado nele mesmo.',
          );
        }

        itensOrdenados.push(itemConectavel);

        const nivelPai = niveisInstancia.get(instanciaPaiId) ?? 0;

        instanciasConectadas.add(itemConectavel.item.instanciaId);

        niveisInstancia.set(itemConectavel.item.instanciaId, nivelPai + 1);
      }

      const instanciasProcessadas = new Set(
        itensConectaveis.map(({ item }) => item.instanciaId),
      );

      itensPendentes = itensPendentes.filter(
        ({ item }) => !instanciasProcessadas.has(item.instanciaId),
      );
    }

    // Mapa: instanciaId → hardwarePaiId do ponto (para validação de obrigatórios por instância)
    // instanciaRaizId representa o hardware principal da montagem
    const instanciasConectadasComHardware = new Map<string, number>();
    instanciasConectadasComHardware.set(instanciaRaizId, hardwarePaiId);

    for (const { item } of itensOrdenados) {
      instanciasConectadasComHardware.set(
        item.instanciaId,
        item.hardwareFilhoId,
      );
    }

    // Pontos obrigatórios validados por instância pai + pontoEncaixeId
    // Para cada hardware que aparece na montagem, verificamos em cada instância física
    const pontosObrigatorios = await this.prisma.pontoEncaixeHardware.findMany({
      where: {
        hardwarePaiId: {
          in: Array.from(instanciasConectadasComHardware.values()),
        },
        ativo: true,
        obrigatorio: true,
      },
      select: {
        id: true,
        hardwarePaiId: true,
        codigo: true,
        nome: true,
      },
    });

    // Para cada ponto obrigatório, verificar se CADA instância do hardware correspondente o preencheu
    const pontosObrigatoriosAusentes: {
      codigo: string;
      instanciaId: string;
    }[] = [];

    for (const pontoObrigatorio of pontosObrigatorios) {
      const instanciasDessePai = [...instanciasConectadasComHardware.entries()]
        .filter(([, hwId]) => hwId === pontoObrigatorio.hardwarePaiId)
        .map(([instId]) => instId);

      for (const instanciaId of instanciasDessePai) {
        const chave = `${instanciaId}:${pontoObrigatorio.id}`;
        if (!ocupacoesEncaixe.has(chave)) {
          pontosObrigatoriosAusentes.push({
            codigo: pontoObrigatorio.codigo,
            instanciaId,
          });
        }
      }
    }

    if (pontosObrigatoriosAusentes.length > 0) {
      const descricoes = pontosObrigatoriosAusentes
        .map(
          ({ codigo, instanciaId }) => `${codigo} (instância ${instanciaId})`,
        )
        .join(', ');

      throw new BadRequestException(
        `Pontos de encaixe obrigatórios não informados: ${descricoes}.`,
      );
    }

    // Resolver cada encaixe preservando o par item ↔ resultado pelo índice
    const resultadosPorItem = await Promise.all(
      itensOrdenados.map(({ item, ponto }) =>
        this.resolverEncaixeHardwarePublico(
          ponto.hardwarePaiId,
          item.pontoEncaixeId,
          item.hardwareFilhoId,
        ).then((resultado) => ({ item, resultado })),
      ),
    );

    const itensSemModelo3D = resultadosPorItem.flatMap(
      ({ item, resultado }) => {
        if (resultado.hardwareFilho.modelo3D !== null) {
          return [];
        }

        return [
          {
            instanciaId: item.instanciaId,
            instanciaPaiId: item.instanciaPaiId ?? null,
            hardwareId: resultado.hardwareFilho.id,
            nome: resultado.hardwareFilho.nome,
            categoria: resultado.hardwareFilho.categoria,
          },
        ];
      },
    );

    const itensSemAjusteEspecifico = resultadosPorItem.flatMap(
      ({ item, resultado }) => {
        if (resultado.ajusteEspecificoAplicado) {
          return [];
        }

        return [
          {
            instanciaId: item.instanciaId,
            instanciaPaiId: item.instanciaPaiId ?? null,
            hardwareId: resultado.hardwareFilho.id,
            nome: resultado.hardwareFilho.nome,
            categoria: resultado.hardwareFilho.categoria,
          },
        ];
      },
    );

    const calibracaoVisualRefinada = itensSemAjusteEspecifico.length === 0;

    const hardwarePaiSemModelo3D = hardwarePai.modelos3D.length === 0;

    const hardwarePaiRequerDesenho =
      hardwarePai.categoria === CategoriaHardware.GABINETE;

    const hardwarePaiRenderizadoPorDesenho =
      hardwarePaiRequerDesenho && hardwarePai.especificacaoGabinete !== null;

    const hardwarePaiSemDadosDesenho =
      hardwarePaiRequerDesenho && hardwarePai.especificacaoGabinete === null;

    const modelo3DHardwarePaiParaRenderizacao = hardwarePaiRequerDesenho
      ? null
      : modelo3DHardwarePai;

    const modoRenderizacaoHardwarePai = hardwarePaiRequerDesenho
      ? hardwarePaiRenderizadoPorDesenho
        ? 'DESENHO'
        : 'INDISPONIVEL'
      : modelo3DHardwarePaiParaRenderizacao
        ? 'MODELO_3D'
        : 'INDISPONIVEL';

    const desenhoHardwarePai =
      hardwarePaiRenderizadoPorDesenho && hardwarePai.especificacaoGabinete
        ? {
            tipo: 'GABINETE_2_5D',
            referenciaVisual: {
              hardwareId: hardwarePai.id,
              nome: hardwarePai.nome,
              marca: hardwarePai.marca,
              modelo: hardwarePai.modelo,
              fidelidadeEsperada: 'FORMA_ESPECIFICA_DO_MODELO',
            },
            estrategiaVisual: {
              cascaGabinete: 'DESENHO_JAVASCRIPT_2_5D',
              perfilForma: 'POR_MODELO_DE_GABINETE',
              componentesInternos: 'MODELOS_3D',
              objetivo: 'REPRODUZIR_FORMA_DO_GABINETE_REAL',
              estadosEnergia: {
                desligado: {
                  modo: 'ESTATICO',
                  animarVentoinhas: false,
                  aplicarIluminacaoConformeHardware: false,
                  realcarComponentesAtivos: false,
                  efeitosVisuaisAprimorados: false,
                },
                ligado: {
                  modo: 'APRIMORADO',
                  animarVentoinhas: true,
                  aplicarIluminacaoConformeHardware: true,
                  realcarComponentesAtivos: true,
                  efeitosVisuaisAprimorados: true,
                },
              },
            },
            convencaoDimensoes: 'ALTURA_LARGURA_PROFUNDIDADE',
            dimensoesMm: {
              altura: hardwarePai.especificacaoGabinete.alturaMm,
              largura: hardwarePai.especificacaoGabinete.larguraMm,
              profundidade: hardwarePai.especificacaoGabinete.profundidadeMm,
            },
            tamanho: hardwarePai.especificacaoGabinete.tamanho,
            estrutura: {
              baias25: hardwarePai.especificacaoGabinete.baias25,
              baias35: hardwarePai.especificacaoGabinete.baias35,
              slotsTraseiros: hardwarePai.especificacaoGabinete.slotsTraseiros,
              suportaGpuVertical:
                hardwarePai.especificacaoGabinete.suportaGpuVertical,
              espacoGerenciamentoCabosMm:
                hardwarePai.especificacaoGabinete.espacoGerenciamentoCabosMm,
            },
            suportesVentoinhas: hardwarePai.especificacaoGabinete.suportesFans,
            suportesRadiador:
              hardwarePai.especificacaoGabinete.suportesRadiador,
          }
        : null;

    return {
      hardwarePai: {
        instanciaId: instanciaRaizId,
        id: hardwarePai.id,
        nome: hardwarePai.nome,
        categoria: hardwarePai.categoria,
        modoRenderizacao: modoRenderizacaoHardwarePai,
        modelo3D: modelo3DHardwarePaiParaRenderizacao,
        desenho: desenhoHardwarePai,

        transformacaoRenderizacao: {
          posicaoX: modelo3DHardwarePaiParaRenderizacao?.posicaoCorrecaoX ?? 0,
          posicaoY: modelo3DHardwarePaiParaRenderizacao?.posicaoCorrecaoY ?? 0,
          posicaoZ: modelo3DHardwarePaiParaRenderizacao?.posicaoCorrecaoZ ?? 0,

          rotacaoX: modelo3DHardwarePaiParaRenderizacao?.rotacaoCorrecaoX ?? 0,
          rotacaoY: modelo3DHardwarePaiParaRenderizacao?.rotacaoCorrecaoY ?? 0,
          rotacaoZ: modelo3DHardwarePaiParaRenderizacao?.rotacaoCorrecaoZ ?? 0,

          escalaX: modelo3DHardwarePaiParaRenderizacao?.escalaCorrecaoX ?? 1,
          escalaY: modelo3DHardwarePaiParaRenderizacao?.escalaCorrecaoY ?? 1,
          escalaZ: modelo3DHardwarePaiParaRenderizacao?.escalaCorrecaoZ ?? 1,
        },
      },

      total: resultadosPorItem.length,

      montagemRenderizavel:
        (hardwarePaiRenderizadoPorDesenho || !hardwarePaiSemModelo3D) &&
        itensSemModelo3D.length === 0,

      hardwarePaiSemModelo3D,
      hardwarePaiRequerDesenho,
      hardwarePaiRenderizadoPorDesenho,
      hardwarePaiSemDadosDesenho,
      itensSemModelo3D,

      calibracaoVisual: {
        status: calibracaoVisualRefinada ? 'REFINADA' : 'BASE',
        refinada: calibracaoVisualRefinada,
        itensSemAjusteEspecifico,
        observacao: calibracaoVisualRefinada
          ? 'Todos os componentes possuem ajuste específico revisado para o ponto de encaixe utilizado.'
          : 'A montagem pode ser renderizada usando os pontos base, mas alguns componentes ainda não possuem ajuste específico revisado para refinamento visual.',
      },

      itens: resultadosPorItem.map(({ item, resultado }) => ({
        instanciaId: item.instanciaId,

        instanciaPaiId: item.instanciaPaiId ?? null,

        nivelHierarquico: niveisInstancia.get(item.instanciaId) ?? 0,

        referenciaTransformacao: 'HARDWARE_PAI',

        hardwarePai: {
          id: resultado.hardwarePai.id,
          nome: resultado.hardwarePai.nome,
          categoria: resultado.hardwarePai.categoria,
        },

        hardwareFilho: resultado.hardwareFilho,
        pontoEncaixe: resultado.pontoEncaixe,
        ajusteEspecificoAplicado: resultado.ajusteEspecificoAplicado,
        ajusteEspecificoId: resultado.ajusteEspecificoId,
        transformacaoFinal: resultado.transformacaoFinal,
        transformacaoRenderizacaoFinal:
          resultado.transformacaoRenderizacaoFinal,
      })),
    };
  }

  async resolverMontagemCompleta(
    gabineteId: number,
    dados: ResolverMontagemCompletaDto,
  ) {
    // ── 1. Resolver estrutura 3D completa ─────────────────────────────────
    // Esta etapa valida instâncias, hierarquia, ciclos, ocupação e pontos
    // obrigatórios antes de qualquer diagnóstico de compatibilidade.
    const montagem3D = await this.resolverMontagem3DPublica(gabineteId, {
      itens: dados.itens,
    });

    const itensMontagem = montagem3D.itens;
    const itensDaCategoria = (categoria: CategoriaHardware) =>
      itensMontagem.filter(
        (item) => item.hardwareFilho.categoria === categoria,
      );

    const placasMae = itensDaCategoria(CategoriaHardware.PLACA_MAE);
    const processadores = itensDaCategoria(CategoriaHardware.PROCESSADOR);
    const memoriasRam = itensDaCategoria(CategoriaHardware.MEMORIA_RAM);
    const placasVideo = itensDaCategoria(CategoriaHardware.PLACA_VIDEO);
    const armazenamentos = itensDaCategoria(CategoriaHardware.ARMAZENAMENTO);
    const ventoinhas = itensDaCategoria(CategoriaHardware.VENTOINHA);
    const fontes = itensDaCategoria(CategoriaHardware.FONTE);
    const coolers = itensDaCategoria(CategoriaHardware.COOLER);

    if (placasMae.length !== 1) {
      throw new BadRequestException(
        placasMae.length === 0
          ? 'A montagem não possui placa-mãe. Adicione uma placa-mãe antes de verificar a compatibilidade.'
          : 'A montagem completa deve possuir exatamente uma placa-mãe.',
      );
    }

    if (processadores.length !== 1) {
      throw new BadRequestException(
        processadores.length === 0
          ? 'A montagem não possui processador. Adicione um processador antes de verificar a compatibilidade.'
          : 'A montagem completa deve possuir exatamente um processador.',
      );
    }

    if (memoriasRam.length === 0) {
      throw new BadRequestException(
        'A montagem não possui memória RAM. Adicione ao menos um módulo antes de verificar a compatibilidade.',
      );
    }

    if (fontes.length !== 1) {
      throw new BadRequestException(
        fontes.length === 0
          ? 'A montagem não possui fonte. Adicione uma fonte antes de verificar a compatibilidade.'
          : 'A montagem completa deve possuir exatamente uma fonte.',
      );
    }

    if (placasVideo.length > 1) {
      throw new BadRequestException(
        'A montagem completa suporta no máximo uma placa de vídeo principal.',
      );
    }

    if (coolers.length > 1) {
      throw new BadRequestException(
        'A montagem completa suporta no máximo um cooler principal de processador.',
      );
    }

    const fonteIdDaArvore = fontes[0].hardwareFilho.id;
    if (dados.fonteId !== undefined && dados.fonteId !== fonteIdDaArvore) {
      throw new BadRequestException(
        `A fonte informada no campo fonteId (${dados.fonteId}) não corresponde à fonte presente na árvore 3D (${fonteIdDaArvore}).`,
      );
    }
    const fonteIdEfetivo = dados.fonteId ?? fonteIdDaArvore;

    const coolerIdDaArvore = coolers[0]?.hardwareFilho.id;
    if (dados.coolerId !== undefined && dados.coolerId !== coolerIdDaArvore) {
      throw new BadRequestException(
        coolerIdDaArvore === undefined
          ? 'Foi informado coolerId, mas não existe uma instância de cooler na árvore 3D.'
          : `O cooler informado no campo coolerId (${dados.coolerId}) não corresponde ao cooler presente na árvore 3D (${coolerIdDaArvore}).`,
      );
    }
    const coolerIdEfetivo = dados.coolerId ?? coolerIdDaArvore;

    // ── 2. Ventoinhas: preservar quantidade física por hardware ───────────
    const configuracoesVentoinhas = dados.ventoinhas ?? [];

    const configuracoesPorInstancia = new Map<
      string,
      (typeof configuracoesVentoinhas)[number]
    >();

    for (const config of configuracoesVentoinhas) {
      if (!config.instanciaId) {
        continue;
      }

      if (configuracoesPorInstancia.has(config.instanciaId)) {
        throw new BadRequestException(
          `A instância de ventoinha ${config.instanciaId} possui mais de uma configuração.`,
        );
      }

      const instanciaVentoinha = ventoinhas.find(
        (item) => item.instanciaId === config.instanciaId,
      );

      if (!instanciaVentoinha) {
        throw new BadRequestException(
          `A instância de ventoinha ${config.instanciaId} não foi encontrada na montagem.`,
        );
      }

      if (instanciaVentoinha.hardwareFilho.id !== config.ventoinhaId) {
        throw new BadRequestException(
          `A instância ${config.instanciaId} não corresponde ao hardware de ventoinha ${config.ventoinhaId}.`,
        );
      }

      configuracoesPorInstancia.set(config.instanciaId, config);
    }

    const ventoinhasDto: VentoinhaMontagemDto[] = [];

    const ventoinhasSemConfiguracaoExplicita = new Map<
      number,
      typeof ventoinhas
    >();

    for (const item of ventoinhas) {
      const config = configuracoesPorInstancia.get(item.instanciaId);

      if (config) {
        ventoinhasDto.push({
          ventoinhaId: item.hardwareFilho.id,
          posicao: config.posicao,
          ...(config.sentido !== undefined && {
            sentido: config.sentido,
          }),
          quantidade: 1,
        });

        continue;
      }

      const hardwareId = item.hardwareFilho.id;
      const instancias =
        ventoinhasSemConfiguracaoExplicita.get(hardwareId) ?? [];

      instancias.push(item);

      ventoinhasSemConfiguracaoExplicita.set(hardwareId, instancias);
    }

    /*
     * Compatibilidade com o formato antigo:
     * configurações sem instanciaId continuam sendo distribuídas entre
     * as instâncias físicas daquele mesmo hardware.
     */
    for (const [
      ventoinhaId,
      instancias,
    ] of ventoinhasSemConfiguracaoExplicita) {
      const configsLegadas = configuracoesVentoinhas.filter(
        (config) =>
          config.instanciaId === undefined &&
          config.ventoinhaId === ventoinhaId,
      );

      if (configsLegadas.length === 0) {
        ventoinhasDto.push({
          ventoinhaId,
          posicao: PosicaoRefrigeracaoGabinete.FRENTE,
          quantidade: instancias.length,
        });

        continue;
      }

      const quantidadeBase = Math.floor(
        instancias.length / configsLegadas.length,
      );

      const resto = instancias.length % configsLegadas.length;

      for (const [indice, config] of configsLegadas.entries()) {
        const quantidade = quantidadeBase + (indice < resto ? 1 : 0);

        if (quantidade === 0) {
          continue;
        }

        ventoinhasDto.push({
          ventoinhaId,
          posicao: config.posicao,
          ...(config.sentido !== undefined && {
            sentido: config.sentido,
          }),
          quantidade,
        });
      }
    }

    // ── 3. Compatibilidade respeitando a árvore de instâncias ──────────────
    // Antes o código fazia um produto cartesiano entre todas as placas-mãe,
    // CPUs e memórias. Isso podia comparar uma peça com uma placa-mãe à qual
    // ela não estava fisicamente ligada. Agora cada placa-mãe usa somente as
    // instâncias filhas dela. Em montagens com uma única placa-mãe, componentes
    // ligados diretamente ao gabinete continuam sendo aceitos como fallback.
    const verificacoesCompatibilidade: Awaited<
      ReturnType<HardwaresService['verificarCompatibilidadeMontagem']>
    >[] = [];

    for (const placaMae of placasMae) {
      const filhosDiretos = itensMontagem.filter(
        (item) => item.instanciaPaiId === placaMae.instanciaId,
      );

      const processadoresDaPlaca = filhosDiretos.filter(
        (item) =>
          item.hardwareFilho.categoria === CategoriaHardware.PROCESSADOR,
      );
      const memoriasDaPlaca = filhosDiretos.filter(
        (item) =>
          item.hardwareFilho.categoria === CategoriaHardware.MEMORIA_RAM,
      );
      const placasVideoDaPlaca = filhosDiretos.filter(
        (item) =>
          item.hardwareFilho.categoria === CategoriaHardware.PLACA_VIDEO,
      );
      const armazenamentosDaPlaca = filhosDiretos.filter(
        (item) =>
          item.hardwareFilho.categoria === CategoriaHardware.ARMAZENAMENTO,
      );

      const processadoresAssociados =
        processadoresDaPlaca.length > 0
          ? processadoresDaPlaca
          : placasMae.length === 1
            ? processadores
            : [];
      const memoriasAssociadas =
        memoriasDaPlaca.length > 0
          ? memoriasDaPlaca
          : placasMae.length === 1
            ? memoriasRam
            : [];
      const placasVideoAssociadas =
        placasVideoDaPlaca.length > 0
          ? placasVideoDaPlaca
          : placasMae.length === 1
            ? placasVideo
            : [];
      const armazenamentosAssociados =
        armazenamentosDaPlaca.length > 0
          ? armazenamentosDaPlaca
          : placasMae.length === 1
            ? armazenamentos
            : [];

      if (processadoresAssociados.length === 0) {
        throw new BadRequestException(
          `Não foi possível associar um processador à instância ${placaMae.instanciaId} da placa-mãe.`,
        );
      }

      if (memoriasAssociadas.length === 0) {
        throw new BadRequestException(
          `Não foi possível associar memória RAM à instância ${placaMae.instanciaId} da placa-mãe.`,
        );
      }

      const memoriaRamIds = [
        ...new Set(memoriasAssociadas.map((item) => item.hardwareFilho.id)),
      ];
      const quantidadePorMemoriaRam = new Map<number, number>();
      for (const memoria of memoriasAssociadas) {
        const hardwareId = memoria.hardwareFilho.id;
        quantidadePorMemoriaRam.set(
          hardwareId,
          (quantidadePorMemoriaRam.get(hardwareId) ?? 0) + 1,
        );
      }

      const armazenamentoIds = armazenamentosAssociados.map(
        (item) => item.hardwareFilho.id,
      );
      const quantidadeModulosRamTotal = memoriasAssociadas.length;
      const placaVideoId = placasVideoAssociadas[0]?.hardwareFilho.id;

      for (const processador of processadoresAssociados) {
        for (const memoriaRamId of memoriaRamIds) {
          verificacoesCompatibilidade.push(
            await this.verificarCompatibilidadeMontagem({
              placaMaeId: placaMae.hardwareFilho.id,
              processadorId: processador.hardwareFilho.id,
              memoriaRamId,
              quantidadeModulosRam:
                quantidadePorMemoriaRam.get(memoriaRamId) ?? 1,
              quantidadeModulosRamTotal,
              gabineteId,
              fonteId: fonteIdEfetivo,
              placaVideoId,
              coolerId: coolerIdEfetivo,
              armazenamentoIds,
              ventoinhas: ventoinhasDto,
            }),
          );
        }
      }
    }

    // ── 4. Resumo físico da configuração ──────────────────────────────────
    // A árvore 3D é a fonte de verdade para quantidades físicas. Isso evita
    // perder 2× RAM/SSD/fans quando várias instâncias usam o mesmo hardwareId.
    const memoriaIdsUnicos = [
      ...new Set(memoriasRam.map((item) => item.hardwareFilho.id)),
    ];
    const memoriasComEspecificacao =
      memoriaIdsUnicos.length === 0
        ? []
        : await this.prisma.hardware.findMany({
            where: { id: { in: memoriaIdsUnicos } },
            select: {
              id: true,
              especificacaoMemoriaRam: {
                select: { capacidadePorModuloGb: true },
              },
            },
          });
    const capacidadeModuloPorHardware = new Map(
      memoriasComEspecificacao.map((hardware) => [
        hardware.id,
        hardware.especificacaoMemoriaRam?.capacidadePorModuloGb ?? 0,
      ]),
    );
    const capacidadeMemoriaTotalGb = memoriasRam.reduce(
      (total, item) =>
        total + (capacidadeModuloPorHardware.get(item.hardwareFilho.id) ?? 0),
      0,
    );

    const resumoFisico = {
      placasMae: placasMae.length,
      processadores: processadores.length,
      placasVideo: placasVideo.length,
      fontes: fontes.length,
      coolers: coolers.length,
      modulosRam: memoriasRam.length,
      capacidadeMemoriaTotalGb,
      armazenamentos: armazenamentos.length,
      ventoinhas: ventoinhas.length,
    };

    // ── 5. Consolidar resultado ─────────────────────────────────────────────
    const compatibilidade =
      verificacoesCompatibilidade.length === 1
        ? verificacoesCompatibilidade[0]
        : {
            compativel: verificacoesCompatibilidade.every(
              (verificacao) => verificacao.compativel,
            ),
            status: verificacoesCompatibilidade.every(
              (verificacao) => verificacao.compativel,
            )
              ? verificacoesCompatibilidade.some(
                  (verificacao) => (verificacao.alertas?.length ?? 0) > 0,
                )
                ? 'COMPATIVEL_COM_ALERTAS'
                : 'COMPATIVEL'
              : 'INCOMPATIVEL',
            resumo: {
              totalVerificacoes: verificacoesCompatibilidade.reduce(
                (soma, verificacao) =>
                  soma + verificacao.resumo.totalVerificacoes,
                0,
              ),
              totalErros: verificacoesCompatibilidade.reduce(
                (soma, verificacao) => soma + verificacao.resumo.totalErros,
                0,
              ),
              totalAlertas: verificacoesCompatibilidade.reduce(
                (soma, verificacao) => soma + verificacao.resumo.totalAlertas,
                0,
              ),
            },
            erros: verificacoesCompatibilidade.flatMap(
              (verificacao) => verificacao.erros,
            ),
            alertas: verificacoesCompatibilidade.flatMap(
              (verificacao) => verificacao.alertas,
            ),
            consumoEnergia: verificacoesCompatibilidade[0].consumoEnergia,
            fluxoAr: verificacoesCompatibilidade[0].fluxoAr,
            resultados: verificacoesCompatibilidade.flatMap(
              (verificacao) => verificacao.resultados,
            ),
          };

    return {
      montagem3D,
      resumoFisico,
      compatibilidade,
    };
  }

  // ── Importação de produto por URL ─────────────────────────────────────────

  private mesmoHostImportacao(a: URL, b: URL): boolean {
    const normalizar = (host: string) =>
      host.toLowerCase().replace(/^www\./, '');
    return normalizar(a.hostname) === normalizar(b.hostname);
  }

  private decodificarEntidadesHtml(texto: string): string {
    const entidades: Record<string, string> = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&lt;': '<',
      '&gt;': '>',
    };

    return texto
      .replace(
        /&(nbsp|amp|quot|#39|apos|lt|gt);/gi,
        (entidade) => entidades[entidade.toLowerCase()] ?? entidade,
      )
      .replace(/&#(\d+);/g, (_match, codigo: string) => {
        const numero = Number(codigo);
        return Number.isSafeInteger(numero) && numero >= 0 && numero <= 0x10ffff
          ? String.fromCodePoint(numero)
          : '';
      });
  }

  private extrairDadosPaginaImportacao(
    html: string,
    url: URL,
    tipoFonte: 'PRINCIPAL' | 'ESPECIFICACOES',
  ) {
    const jsonLdBlocos: string[] = [];
    const reJsonLd =
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = reJsonLd.exec(html)) !== null) {
      const bloco = match[1]?.trim();
      if (bloco) jsonLdBlocos.push(bloco);
    }

    const metaMap: Record<string, string> = {};
    const reMeta = /<meta\s+[^>]*>/gi;
    while ((match = reMeta.exec(html)) !== null) {
      const tag = match[0];
      const chave = tag
        .match(/(?:property|name)=["']([^"']+)["']/i)?.[1]
        ?.toLowerCase();
      const conteudo = tag.match(/content=["']([^"']*)["']/i)?.[1];
      if (chave && conteudo !== undefined) {
        metaMap[chave] = this.decodificarEntidadesHtml(conteudo.trim());
      }
    }

    const tituloHtml = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const titulo =
      metaMap['og:title'] ??
      (tituloHtml
        ? this.decodificarEntidadesHtml(
            tituloHtml
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim(),
          )
        : undefined);

    const textoCompleto = this.decodificarEntidadesHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    );

    const indiceFichaTecnica = textoCompleto.search(
      /(?:\bSpecifications?\b|\bEspecifica(?:c|ç)(?:ao|ão|oes|ões)\b|\bOutput Capacity\b|\bInput Voltage\b|\bConnectors?\b)/i,
    );
    const textoLimpo =
      textoCompleto.length <= 48_000
        ? textoCompleto
        : indiceFichaTecnica >= 0
          ? textoCompleto.slice(
              Math.max(0, indiceFichaTecnica - 4_000),
              indiceFichaTecnica + 44_000,
            )
          : `${textoCompleto.slice(0, 24_000)} ${textoCompleto.slice(-24_000)}`;

    return {
      url: url.toString(),
      tipo: tipoFonte,
      titulo,
      jsonLd: jsonLdBlocos,
      meta: metaMap,
      textoExtraido: textoLimpo,
    };
  }

  private async baixarPaginaImportacao(
    urlOriginal: string | URL,
  ): Promise<{ urlFinal: URL; html: string }> {
    let urlAtual = await this.validarUrlPublicaImportacao(
      urlOriginal instanceof URL ? urlOriginal.toString() : urlOriginal,
    );

    for (
      let redirecionamentos = 0;
      redirecionamentos <= 3;
      redirecionamentos++
    ) {
      let resposta: Awaited<ReturnType<typeof requisitarUrlPublicaUmaVez>>;

      try {
        resposta = await requisitarUrlPublicaUmaVez(urlAtual, {
          timeoutMs: 15_000,
          limiteRespostaBytes: 2_000_000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; CriaByteCatalogBot/1.0; +https://criabyte.com.br)',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (erro) {
        throw new BadRequestException(
          erro instanceof Error
            ? erro.message
            : 'Não foi possível acessar o endereço informado.',
        );
      }

      if (resposta.status >= 300 && resposta.status < 400) {
        const local = obterCabecalhoHttp(resposta, 'location');
        if (!local) {
          throw new BadRequestException(
            'A página retornou um redirecionamento sem destino.',
          );
        }

        if (redirecionamentos === 3) {
          throw new BadRequestException(
            'A página realizou redirecionamentos demais.',
          );
        }

        const destino = new URL(local, urlAtual);
        urlAtual = await this.validarUrlPublicaImportacao(destino.toString());
        continue;
      }

      if (!resposta.ok) {
        throw new BadRequestException(
          `A página retornou o status ${resposta.status}. Verifique o endereço.`,
        );
      }

      const tipo = obterCabecalhoHttp(resposta, 'content-type') ?? '';
      if (
        !tipo.toLowerCase().includes('text/html') &&
        !tipo.toLowerCase().includes('application/xhtml+xml')
      ) {
        throw new BadRequestException(
          'O endereço não retornou uma página HTML de produto.',
        );
      }

      return {
        urlFinal: urlAtual,
        html: resposta.corpo.toString('utf8'),
      };
    }

    throw new BadRequestException(
      'Não foi possível concluir a coleta da página.',
    );
  }

  private descobrirUrlsTecnicasImportacao(html: string, principal: URL): URL[] {
    const candidatos: URL[] = [];
    const vistos = new Set<string>();

    const adicionar = (url: URL) => {
      url.hash = '';
      if (!this.mesmoHostImportacao(principal, url)) return;
      const chave = url.toString();
      if (chave === principal.toString() || vistos.has(chave)) return;
      vistos.add(chave);
      candidatos.push(url);
    };

    const host = principal.hostname.toLowerCase();
    const caminhoBase = principal.pathname.replace(/\/+$/, '');

    // Fabricantes que separam a ficha técnica em uma rota própria.
    if (host === 'gigabyte.com' || host.endsWith('.gigabyte.com')) {
      if (!/\/sp$/i.test(caminhoBase)) {
        adicionar(
          new URL(`${caminhoBase}/sp${principal.search}`, principal.origin),
        );
      }
    }

    if (host === 'msi.com' || host.endsWith('.msi.com')) {
      if (!/\/Specification$/i.test(caminhoBase)) {
        adicionar(new URL(`${caminhoBase}/Specification`, principal.origin));
      }
    }

    if (host === 'asus.com' || host.endsWith('.asus.com')) {
      if (!/\/techspec\/?$/i.test(principal.pathname)) {
        adicionar(new URL(`${caminhoBase}/techspec/`, principal.origin));
      }
    }

    // Também segue links técnicos reais encontrados no próprio HTML. Isso
    // cobre fabricantes/idiomas em que a rota muda e evita depender apenas de
    // regras específicas por marca.
    const reLink = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = reLink.exec(html)) !== null && candidatos.length < 8) {
      const href = this.decodificarEntidadesHtml(match[1] ?? '').trim();
      const texto = this.decodificarEntidadesHtml(
        (match[2] ?? '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      ).toLowerCase();
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        continue;
      }

      let destino: URL;
      try {
        destino = new URL(href, principal);
      } catch {
        continue;
      }

      const alvo = `${destino.pathname} ${texto}`.toLowerCase();
      if (
        /(?:\/sp(?:\/|$)|specification|specifications|techspec|technical[-_ ]?spec|especifica(?:c|ç)(?:ao|ão|oes|ões))/.test(
          alvo,
        )
      ) {
        adicionar(destino);
      }
    }

    return candidatos;
  }

  async importarProdutoPorUrl(
    urlOriginal: string,
  ): Promise<Record<string, unknown>> {
    // Valida a URL antes de qualquer tentativa de coleta. Se o site bloquear
    // fetchs do backend, a URL já validada ainda pode ser entregue ao URL
    // Context do Gemini sem transformar o bloqueio do fabricante em erro 500.
    const urlInicial = await this.validarUrlPublicaImportacao(urlOriginal);
    const avisosColeta: string[] = [];

    let paginaPrincipal: { urlFinal: URL; html: string } | null = null;

    try {
      paginaPrincipal = await this.baixarPaginaImportacao(urlInicial);
    } catch (erro) {
      const mensagem =
        erro instanceof Error ? erro.message : 'falha desconhecida na coleta';
      avisosColeta.push(
        `A coleta HTML direta não foi concluída: ${mensagem}. A IA poderá tentar a leitura da URL pública pelo URL Context.`,
      );
    }

    const urlPrincipal = paginaPrincipal?.urlFinal ?? urlInicial;
    const htmlPrincipal = paginaPrincipal?.html ?? '';
    const fontes = paginaPrincipal
      ? [
          this.extrairDadosPaginaImportacao(
            paginaPrincipal.html,
            paginaPrincipal.urlFinal,
            'PRINCIPAL',
          ),
        ]
      : [];

    const urlsTecnicas = this.descobrirUrlsTecnicasImportacao(
      htmlPrincipal,
      urlPrincipal,
    );

    // No máximo duas páginas complementares: mantém a importação rápida e
    // previsível, mas cobre páginas de Specifications/Tech Specs como as da
    // GIGABYTE, MSI e ASUS. Mesmo que o HTML principal tenha sido bloqueado,
    // as rotas técnicas conhecidas continuam disponíveis para o URL Context.
    for (const urlTecnica of urlsTecnicas.slice(0, 2)) {
      try {
        const pagina = await this.baixarPaginaImportacao(urlTecnica);
        if (fontes.some((fonte) => fonte.url === pagina.urlFinal.toString())) {
          continue;
        }
        fontes.push(
          this.extrairDadosPaginaImportacao(
            pagina.html,
            pagina.urlFinal,
            'ESPECIFICACOES',
          ),
        );
      } catch (erro) {
        const mensagem =
          erro instanceof Error ? erro.message : 'falha desconhecida';
        avisosColeta.push(
          `Não foi possível coletar diretamente ${urlTecnica.toString()}: ${mensagem}`,
        );
      }
    }

    const textoExtraido = fontes
      .map(
        (fonte) =>
          `=== FONTE ${fonte.tipo}: ${fonte.url} ===\n${fonte.textoExtraido}`,
      )
      .join('\n\n')
      .slice(0, 48_000);

    const urlsParaContextoIa = Array.from(
      new Set([
        urlPrincipal.toString(),
        ...urlsTecnicas.slice(0, 2).map((url) => url.toString()),
        ...fontes.map((fonte) => fonte.url),
      ]),
    ).slice(0, 5);

    return {
      urlOriginal,
      urlFinal: urlPrincipal.toString(),
      fontesConsultadas: fontes.map((fonte) => ({
        url: fonte.url,
        tipo: fonte.tipo,
        titulo: fonte.titulo,
      })),
      urlsParaContextoIa,
      avisosColeta,
      coletaHtmlDisponivel: fontes.length > 0,
      jsonLd: fontes.flatMap((fonte) => fonte.jsonLd),
      meta: fontes[0]?.meta ?? {},
      metasPorFonte: fontes.map((fonte) => ({
        url: fonte.url,
        meta: fonte.meta,
      })),
      textoExtraido,
    };
  }
}
