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
  TipoCooler,
  PosicaoRefrigeracaoGabinete,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarHardwareDto } from './dtos/atualizar-hardware.dto';
import { CriarCompatibilidadeCpuPlacaMaeDto } from './dtos/criar-compatibilidade-cpu-placa-mae.dto';
import { CriarCompatibilidadeMemoriaPlacaMaeDto } from './dtos/criar-compatibilidade-memoria-placa-mae.dto';
import { CriarHardwareDto } from './dtos/criar-hardware.dto';
import type { SuporteRadiadorGabinete } from '../generated/prisma/client';
import {
  SentidoFluxoAr,
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
        modelos3D: true,
        pontosEncaixe: true,
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
      },
    });

    if (!hardware) {
      throw new NotFoundException('Hardware não encontrado.');
    }

    return hardware;
  }

  async criar(dados: CriarHardwareDto) {
    this.validarEspecificacaoDaCategoria(dados);

    const nome = dados.nome.trim();
    const marca = dados.marca.trim();
    const modelo = dados.modelo.trim();

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
          imagemUrl: dados.imagemUrl?.trim(),
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
      especificacaoMemoria.quantidadeModulos >
      especificacaoPlacaMae.slotsMemoria
    ) {
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
      especificacaoMemoria.capacidadePorModuloGb *
      especificacaoMemoria.quantidadeModulos;

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
  ) {
    const [resultadoCpu, resultadoMemoria, processador, placaMae, memoriaRam] =
      await Promise.all([
        this.verificarCompatibilidadeCpuPlacaMae(placaMaeId, processadorId),
        this.verificarCompatibilidadeMemoriaPlacaMae(placaMaeId, memoriaRamId),
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

    const capacidadeTotal =
      memoria.capacidadePorModuloGb * memoria.quantidadeModulos;

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

    const armazenamentoM2 = especificacaoArmazenamento.tamanhoM2Mm !== null;

    if (
      especificacaoArmazenamento.interface === InterfaceArmazenamento.SATA &&
      !armazenamentoM2
    ) {
      if (especificacaoPlacaMae.portasSata < 1) {
        erros.push('A placa-mãe não possui portas SATA disponíveis.');
      }
    } else if (
      especificacaoArmazenamento.interface === InterfaceArmazenamento.SATA ||
      especificacaoArmazenamento.interface === InterfaceArmazenamento.NVME_PCIE
    ) {
      if (especificacaoArmazenamento.tamanhoM2Mm === null) {
        erros.push('O armazenamento M.2 não possui o tamanho cadastrado.');
      }

      if (especificacaoArmazenamento.chaveM2 === null) {
        erros.push('O armazenamento M.2 não possui a chave cadastrada.');
      }

      if (slotsM2Compativeis.length === 0) {
        erros.push(
          'Nenhum slot M.2 da placa-mãe é compatível com este armazenamento.',
        );
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

    const consumoArmazenamentosWatts = armazenamentos.reduce(
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

  async verificarCompatibilidadeMontagem(
    dados: VerificarCompatibilidadeMontagemDto,
  ) {
    const resultados: Array<{
      etapa: string;
      compativel: boolean;
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
        compativel: resultado.compativel === true,
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

    const compativel = resultados.every((resultado) => resultado.compativel);

    const status = !compativel
      ? 'INCOMPATIVEL'
      : alertas.length > 0
        ? 'COMPATIVEL_COM_ALERTAS'
        : 'COMPATIVEL';

    return {
      compativel,
      status,
      resumo: {
        totalVerificacoes: resultados.length,
        totalErros: erros.length,
        totalAlertas: alertas.length,
      },
      erros,
      alertas,
      consumoEnergia,
      fluxoAr,
      resultados,
    };
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

    return this.prisma.modelo3DHardware.create({
      data: {
        hardwareId,
        nome: dados.nome,
        arquivoUrl: dados.arquivoUrl,
        formato: dados.formato,
        versao: dados.versao,
        alturaRealMm: dados.alturaRealMm,
        larguraRealMm: dados.larguraRealMm,
        profundidadeRealMm: dados.profundidadeRealMm,
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
        versao: dados.versao,
        alturaRealMm: dados.alturaRealMm,
        larguraRealMm: dados.larguraRealMm,
        profundidadeRealMm: dados.profundidadeRealMm,
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
              versao: true,
              alturaRealMm: true,
              larguraRealMm: true,
              profundidadeRealMm: true,
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
              versao: true,
              alturaRealMm: true,
              larguraRealMm: true,
              profundidadeRealMm: true,
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
            versao: true,
            alturaRealMm: true,
            larguraRealMm: true,
            profundidadeRealMm: true,
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

    const pontosEncaixeIds = dados.itens.map((item) => item.pontoEncaixeId);

    const pontosDuplicados = pontosEncaixeIds.filter(
      (pontoEncaixeId, indice) =>
        pontosEncaixeIds.indexOf(pontoEncaixeId) !== indice,
    );

    if (pontosDuplicados.length > 0) {
      throw new BadRequestException(
        'Não é permitido enviar mais de uma peça para o mesmo ponto de encaixe.',
      );
    }

    const pontosObrigatorios = await this.prisma.pontoEncaixeHardware.findMany({
      where: {
        hardwarePaiId,
        ativo: true,
        obrigatorio: true,
      },
      select: {
        id: true,
        codigo: true,
        nome: true,
      },
    });

    const pontosInformados = new Set(
      dados.itens.map((item) => item.pontoEncaixeId),
    );

    const pontosObrigatoriosAusentes = pontosObrigatorios.filter(
      (ponto) => !pontosInformados.has(ponto.id),
    );

    if (pontosObrigatoriosAusentes.length > 0) {
      const codigosAusentes = pontosObrigatoriosAusentes
        .map((ponto) => ponto.codigo)
        .join(', ');

      throw new BadRequestException(
        `Pontos de encaixe obrigatórios não informados: ${codigosAusentes}.`,
      );
    }

    const resultados = await Promise.all(
      dados.itens.map((item) =>
        this.resolverEncaixeHardwarePublico(
          hardwarePaiId,
          item.pontoEncaixeId,
          item.hardwareFilhoId,
        ),
      ),
    );

    const itensSemModelo3D = resultados
      .filter((resultado) => resultado.hardwareFilho.modelo3D === null)
      .map((resultado) => ({
        hardwareId: resultado.hardwareFilho.id,
        nome: resultado.hardwareFilho.nome,
        categoria: resultado.hardwareFilho.categoria,
      }));

    const hardwarePaiSemModelo3D = hardwarePai.modelos3D.length === 0;

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
      total: resultados.length,
      montagemRenderizavel:
        !hardwarePaiSemModelo3D && itensSemModelo3D.length === 0,

      hardwarePaiSemModelo3D,
      itensSemModelo3D,
      itens: resultados.map((resultado) => ({
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
}
