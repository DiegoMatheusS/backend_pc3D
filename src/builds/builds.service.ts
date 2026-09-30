import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  CategoriaHardware,
  GrupoCategoriaProduto,
  PosicaoRefrigeracaoGabinete,
  StatusAvaliacao,
  StatusOferta,
  TipoProduto,
} from '../generated/prisma/enums';
import { HardwaresService } from '../hardwares/hardwares.service';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarBuildDto } from './dtos/atualizar-build.dto';
import { BuildComponenteDto, CriarBuildDto } from './dtos/criar-build.dto';
import { FiltrarBuildsDto } from './dtos/filtrar-builds.dto';

@Injectable()
export class BuildsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hardwaresService: HardwaresService,
  ) {}

  private criarSlug(texto: string): string {
    return (
      texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'pc-montado'
    );
  }

  private async criarSlugUnico(texto: string, ignorarProdutoId?: number) {
    const base = this.criarSlug(texto);
    let slug = base;
    let numero = 2;
    while (true) {
      const existente = await this.prisma.produto.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existente || existente.id === ignorarProdutoId) return slug;
      slug = `${base}-${numero++}`;
    }
  }

  private async garantirCategoria() {
    return this.prisma.categoriaProduto.upsert({
      where: { slug: 'pcs-montados' },
      create: {
        nome: 'PCs montados',
        slug: 'pcs-montados',
        grupo: GrupoCategoriaProduto.COMPUTADORES,
        ordem: 10,
      },
      update: {},
      select: { id: true },
    });
  }

  private includeDetalhado() {
    const agora = new Date();
    return {
      produto: {
        include: {
          categoria: true,
          ofertas: {
            where: {
              status: StatusOferta.ATIVA,
              parceiro: { ativo: true },
              OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
            },
            orderBy: { preco: 'asc' as const },
            include: {
              parceiro: {
                select: { id: true, nome: true, slug: true, logoUrl: true },
              },
            },
          },
        },
      },
      componentes: {
        orderBy: { ordem: 'asc' as const },
        include: {
          hardware: {
            include: {
              especificacaoProcessador: true,
              especificacaoPlacaVideo: true,
              especificacaoMemoriaRam: true,
              especificacaoArmazenamento: true,
              especificacaoVentoinha: true,
              especificacaoCooler: true,
              especificacaoFonte: true,
            },
          },
        },
      },
    };
  }

  private async validarComponentes(
    componentes: BuildComponenteDto[],
    exigirPublicados: boolean,
  ) {
    const ids = [...new Set(componentes.map((item) => item.hardwareId))];
    const hardwares = await this.prisma.hardware.findMany({
      where: {
        id: { in: ids },
        ativo: true,
        ...(exigirPublicados && { publicado: true }),
      },
      select: { id: true, categoria: true },
    });
    if (hardwares.length !== ids.length) {
      throw new BadRequestException(
        exigirPublicados
          ? 'Um ou mais componentes da build não existem, estão inativos ou não estão publicados.'
          : 'Um ou mais componentes da build não existem ou estão inativos.',
      );
    }
    const mapa = new Map(hardwares.map((hardware) => [hardware.id, hardware]));
    for (const componente of componentes) {
      const hardware = mapa.get(componente.hardwareId);
      if (!hardware || hardware.categoria !== componente.categoria) {
        throw new BadRequestException(
          `A categoria informada para o hardware ${componente.hardwareId} não corresponde ao cadastro.`,
        );
      }
    }
  }

  private async validarMemoriaFisicaBuild(
    componentes: BuildComponenteDto[],
  ): Promise<void> {
    const placaMae = componentes.find(
      (item) => item.categoria === CategoriaHardware.PLACA_MAE,
    );
    const memorias = componentes.filter(
      (item) => item.categoria === CategoriaHardware.MEMORIA_RAM,
    );

    if (!placaMae || memorias.length === 0) return;

    const memoriaIds = [...new Set(memorias.map((item) => item.hardwareId))];

    const [placaMaeDb, memoriasDb] = await Promise.all([
      this.prisma.hardware.findUnique({
        where: { id: placaMae.hardwareId },
        select: {
          especificacaoPlacaMae: {
            select: {
              slotsMemoria: true,
              capacidadeMaximaMemoriaGb: true,
              capacidadeMaximaPorSlotGb: true,
              tiposMemoriaSuportados: true,
            },
          },
        },
      }),
      this.prisma.hardware.findMany({
        where: { id: { in: memoriaIds } },
        select: {
          id: true,
          nome: true,
          especificacaoMemoriaRam: {
            select: {
              tipo: true,
              capacidadePorModuloGb: true,
              quantidadeModulos: true,
            },
          },
        },
      }),
    ]);

    const especificacaoPlacaMae = placaMaeDb?.especificacaoPlacaMae;
    if (!especificacaoPlacaMae) {
      throw new BadRequestException(
        'A placa-mãe da build não possui especificação de memória cadastrada.',
      );
    }

    const memoriaPorId = new Map(
      memoriasDb.map((hardware) => [hardware.id, hardware]),
    );

    let totalModulosFisicos = 0;
    let capacidadeTotalGb = 0;

    for (const componente of memorias) {
      const hardware = memoriaPorId.get(componente.hardwareId);
      const especificacao = hardware?.especificacaoMemoriaRam;

      if (!hardware || !especificacao) {
        throw new BadRequestException(
          `A memória RAM ${componente.hardwareId} não possui especificação técnica completa.`,
        );
      }

      if (
        especificacaoPlacaMae.tiposMemoriaSuportados.length > 0 &&
        !especificacaoPlacaMae.tiposMemoriaSuportados.includes(
          especificacao.tipo,
        )
      ) {
        throw new BadRequestException(
          `A memória ${hardware.nome} usa ${especificacao.tipo}, tipo não suportado pela placa-mãe da build.`,
        );
      }

      if (
        especificacaoPlacaMae.capacidadeMaximaPorSlotGb !== null &&
        especificacao.capacidadePorModuloGb >
          especificacaoPlacaMae.capacidadeMaximaPorSlotGb
      ) {
        throw new BadRequestException(
          `Cada módulo de ${hardware.nome} possui ${especificacao.capacidadePorModuloGb} GB, acima do limite de ${especificacaoPlacaMae.capacidadeMaximaPorSlotGb} GB por slot da placa-mãe.`,
        );
      }

      const quantidadeComercial = componente.quantidade ?? 1;
      const quantidadeFisica =
        quantidadeComercial * especificacao.quantidadeModulos;

      totalModulosFisicos += quantidadeFisica;
      capacidadeTotalGb +=
        quantidadeFisica * especificacao.capacidadePorModuloGb;
    }

    if (totalModulosFisicos > especificacaoPlacaMae.slotsMemoria) {
      throw new BadRequestException(
        `A build utiliza ${totalModulosFisicos} módulo(s) físico(s) de RAM, mas a placa-mãe possui apenas ${especificacaoPlacaMae.slotsMemoria} slot(s).`,
      );
    }

    if (
      especificacaoPlacaMae.capacidadeMaximaMemoriaGb !== null &&
      capacidadeTotalGb > especificacaoPlacaMae.capacidadeMaximaMemoriaGb
    ) {
      throw new BadRequestException(
        `A build possui ${capacidadeTotalGb} GB de RAM, acima do limite de ${especificacaoPlacaMae.capacidadeMaximaMemoriaGb} GB da placa-mãe.`,
      );
    }
  }

  private async validarCompletudeBuild(
    componentes: BuildComponenteDto[],
  ): Promise<void> {
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
        .reduce((total, item) => total + (item.quantidade ?? 1), 0);
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
        .reduce((total, item) => total + (item.quantidade ?? 1), 0);

      if (quantidade > 1) {
        throw new BadRequestException(
          `Uma build publicada suporta no máximo uma unidade da categoria ${categoria}.`,
        );
      }
    }

    await this.validarMemoriaFisicaBuild(componentes);

    if (!categorias.has(CategoriaHardware.PLACA_VIDEO)) {
      const processadorId = componentes.find(
        (item) => item.categoria === CategoriaHardware.PROCESSADOR,
      )?.hardwareId;

      const processador = processadorId
        ? await this.prisma.hardware.findUnique({
            where: { id: processadorId },
            select: {
              especificacaoProcessador: {
                select: { possuiVideoIntegrado: true },
              },
            },
          })
        : null;

      if (!processador?.especificacaoProcessador?.possuiVideoIntegrado) {
        throw new BadRequestException(
          'A build não possui placa de vídeo e o processador informado não possui vídeo integrado.',
        );
      }
    }
  }

  private async calcularConsumo(componentes: BuildComponenteDto[]) {
    const ids = [...new Set(componentes.map((item) => item.hardwareId))];
    const hardwares = await this.prisma.hardware.findMany({
      where: { id: { in: ids } },
      include: {
        especificacaoProcessador: true,
        especificacaoMemoriaRam: true,
        especificacaoPlacaVideo: true,
        especificacaoArmazenamento: true,
        especificacaoVentoinha: true,
        especificacaoCooler: true,
      },
    });
    const mapa = new Map(hardwares.map((hardware) => [hardware.id, hardware]));
    let watts = 50;

    for (const componente of componentes) {
      const hardware = mapa.get(componente.hardwareId);
      if (!hardware) continue;
      const quantidade = componente.quantidade ?? 1;
      let unitario = 0;
      if (hardware.categoria === CategoriaHardware.PROCESSADOR) {
        unitario = hardware.especificacaoProcessador?.tdpWatts ?? 0;
      } else if (hardware.categoria === CategoriaHardware.MEMORIA_RAM) {
        unitario = hardware.especificacaoMemoriaRam?.consumoWatts ?? 0;
      } else if (hardware.categoria === CategoriaHardware.PLACA_VIDEO) {
        unitario = hardware.especificacaoPlacaVideo?.consumoWatts ?? 0;
      } else if (hardware.categoria === CategoriaHardware.ARMAZENAMENTO) {
        unitario = hardware.especificacaoArmazenamento?.consumoWatts ?? 0;
      } else if (hardware.categoria === CategoriaHardware.VENTOINHA) {
        const fan = hardware.especificacaoVentoinha;
        unitario =
          fan?.tensaoVolts !== null &&
          fan?.tensaoVolts !== undefined &&
          fan.correnteAmperes !== null &&
          fan.correnteAmperes !== undefined
            ? fan.tensaoVolts * fan.correnteAmperes
            : 0;
      } else if (hardware.categoria === CategoriaHardware.COOLER) {
        unitario =
          hardware.especificacaoCooler?.consumoWatts ??
          hardware.especificacaoCooler?.consumoBombaWatts ??
          0;
      }
      watts += unitario * quantidade;
    }

    const recomendada = Math.max(200, Math.ceil((watts * 1.3) / 50) * 50);
    return {
      consumoEstimadoWatts: Number(watts.toFixed(2)),
      fonteRecomendadaWatts: recomendada,
    };
  }

  /**
   * Reutilização do núcleo técnico das Builds comerciais por outros domínios,
   * como Builds da Comunidade. Não persiste nada: apenas valida e executa o
   * mesmo motor de compatibilidade já usado pelo PC Builder.
   */
  async analisarCompatibilidadeComponentes(componentes: BuildComponenteDto[]) {
    await this.validarComponentes(componentes, true);
    await this.validarCompletudeBuild(componentes);

    const placaMae = componentes.find(
      (item) => item.categoria === CategoriaHardware.PLACA_MAE,
    );
    const processador = componentes.find(
      (item) => item.categoria === CategoriaHardware.PROCESSADOR,
    );
    const gabinete = componentes.find(
      (item) => item.categoria === CategoriaHardware.GABINETE,
    );
    const fonte = componentes.find(
      (item) => item.categoria === CategoriaHardware.FONTE,
    );

    if (!placaMae || !processador || !gabinete || !fonte) {
      throw new BadRequestException(
        'A build precisa conter placa-mãe, processador, gabinete e fonte para executar a compatibilidade.',
      );
    }
    const placaVideo = componentes.find(
      (item) => item.categoria === CategoriaHardware.PLACA_VIDEO,
    );
    const cooler = componentes.find(
      (item) => item.categoria === CategoriaHardware.COOLER,
    );
    const memorias = componentes.filter(
      (item) => item.categoria === CategoriaHardware.MEMORIA_RAM,
    );

    const memoriaIds = [...new Set(memorias.map((item) => item.hardwareId))];
    const [memoriasDb, processadorDb] = await Promise.all([
      this.prisma.hardware.findMany({
        where: { id: { in: memoriaIds } },
        select: {
          id: true,
          especificacaoMemoriaRam: {
            select: {
              quantidadeModulos: true,
              capacidadePorModuloGb: true,
            },
          },
        },
      }),
      this.prisma.hardware.findUnique({
        where: { id: processador.hardwareId },
        select: {
          especificacaoProcessador: {
            select: { capacidadeMemoriaMaximaGb: true },
          },
        },
      }),
    ]);
    const memoriaPorId = new Map(memoriasDb.map((item) => [item.id, item]));

    const memoriasFisicasPorId = new Map<
      number,
      {
        hardwareId: number;
        quantidadeFisica: number;
        capacidadeTotalGb: number;
      }
    >();

    for (const item of memorias) {
      const especificacao = memoriaPorId.get(
        item.hardwareId,
      )?.especificacaoMemoriaRam;
      const quantidadeFisica =
        (item.quantidade ?? 1) * (especificacao?.quantidadeModulos ?? 1);
      const capacidadeTotalGb =
        quantidadeFisica * (especificacao?.capacidadePorModuloGb ?? 0);
      const existente = memoriasFisicasPorId.get(item.hardwareId);

      if (existente) {
        existente.quantidadeFisica += quantidadeFisica;
        existente.capacidadeTotalGb += capacidadeTotalGb;
      } else {
        memoriasFisicasPorId.set(item.hardwareId, {
          hardwareId: item.hardwareId,
          quantidadeFisica,
          capacidadeTotalGb,
        });
      }
    }

    const memoriasFisicas = [...memoriasFisicasPorId.values()];
    const memoriaPrincipal = memoriasFisicas[0];
    if (!memoriaPrincipal) {
      throw new BadRequestException(
        'A build precisa conter memória RAM para executar a compatibilidade.',
      );
    }

    const quantidadeModulosRamTotal = memoriasFisicas.reduce(
      (total, item) => total + item.quantidadeFisica,
      0,
    );
    const capacidadeMemoriaTotalGb = memoriasFisicas.reduce(
      (total, item) => total + item.capacidadeTotalGb,
      0,
    );

    const armazenamentoIds = componentes
      .filter((item) => item.categoria === CategoriaHardware.ARMAZENAMENTO)
      .flatMap((item) =>
        Array.from({ length: item.quantidade ?? 1 }, () => item.hardwareId),
      );

    const normalizarPosicaoVentoinha = (
      valor: string | null | undefined,
    ): PosicaoRefrigeracaoGabinete | null => {
      switch (valor?.trim().toUpperCase()) {
        case 'FRENTE':
        case 'FRONTAL':
          return PosicaoRefrigeracaoGabinete.FRENTE;
        case 'TOPO':
        case 'SUPERIOR':
          return PosicaoRefrigeracaoGabinete.TOPO;
        case 'TRASEIRA':
          return PosicaoRefrigeracaoGabinete.TRASEIRA;
        case 'INFERIOR':
          return PosicaoRefrigeracaoGabinete.INFERIOR;
        case 'LATERAL':
          return PosicaoRefrigeracaoGabinete.LATERAL;
        default:
          return null;
      }
    };

    const alertasPosicaoVentoinha: Array<{
      etapa: string;
      mensagem: string;
    }> = [];

    const ventoinhas = componentes
      .filter((item) => item.categoria === CategoriaHardware.VENTOINHA)
      .flatMap((item) => {
        const posicao = normalizarPosicaoVentoinha(item.posicao);
        if (posicao === null) {
          alertasPosicaoVentoinha.push({
            etapa: `VENTOINHA_POSICAO_${item.hardwareId}`,
            mensagem:
              'A ventoinha não possui posição reconhecida; a compatibilidade física dessa ventoinha não foi validada.',
          });
          return [];
        }
        return [
          {
            ventoinhaId: item.hardwareId,
            posicao,
            quantidade: item.quantidade ?? 1,
          },
        ];
      });

    const compatibilidadeBase =
      await this.hardwaresService.verificarCompatibilidadeMontagem({
        placaMaeId: placaMae.hardwareId,
        processadorId: processador.hardwareId,
        memoriaRamId: memoriaPrincipal.hardwareId,
        quantidadeModulosRam: memoriaPrincipal.quantidadeFisica,
        quantidadeModulosRamTotal,
        gabineteId: gabinete.hardwareId,
        fonteId: fonte.hardwareId,
        ...(placaVideo !== undefined && {
          placaVideoId: placaVideo.hardwareId,
        }),
        ...(cooler !== undefined && { coolerId: cooler.hardwareId }),
        ...(armazenamentoIds.length > 0 && { armazenamentoIds }),
        ...(ventoinhas.length > 0 && { ventoinhas }),
      });

    const memoriasAdicionais = await Promise.all(
      memoriasFisicas.slice(1).map(async (memoria) => ({
        hardwareId: memoria.hardwareId,
        resultado:
          await this.hardwaresService.verificarCompatibilidadeConjuntoPrincipal(
            placaMae.hardwareId,
            processador.hardwareId,
            memoria.hardwareId,
            memoria.quantidadeFisica,
          ),
      })),
    );

    const errosMemoriasAdicionais = memoriasAdicionais.flatMap((item) => {
      if (item.resultado.compativel !== false) return [];
      const mensagens = item.resultado.erros ?? [];
      return (
        mensagens.length > 0
          ? mensagens
          : ['A memória RAM adicional é incompatível com o conjunto principal.']
      ).map((mensagem) => ({
        etapa: `MEMORIA_ADICIONAL_${item.hardwareId}`,
        mensagem,
      }));
    });

    const alertasMemoriasAdicionais = memoriasAdicionais.flatMap((item) => {
      const mensagens = [...(item.resultado.alertas ?? [])];
      if (item.resultado.compativel === null) {
        mensagens.push(
          'A compatibilidade desta memória RAM adicional não pôde ser confirmada completamente.',
        );
      }
      return mensagens.map((mensagem) => ({
        etapa: `MEMORIA_ADICIONAL_${item.hardwareId}`,
        mensagem,
      }));
    });

    const limiteMemoriaCpuGb =
      processadorDb?.especificacaoProcessador?.capacidadeMemoriaMaximaGb ??
      null;
    const errosCapacidadeTotal =
      limiteMemoriaCpuGb !== null &&
      capacidadeMemoriaTotalGb > limiteMemoriaCpuGb
        ? [
            {
              etapa: 'MEMORIA_CAPACIDADE_TOTAL_PROCESSADOR',
              mensagem: `A build possui ${capacidadeMemoriaTotalGb} GB de RAM, acima do limite de ${limiteMemoriaCpuGb} GB do processador.`,
            },
          ]
        : [];

    const erros = [
      ...compatibilidadeBase.erros,
      ...errosMemoriasAdicionais,
      ...errosCapacidadeTotal,
    ];
    const alertas = [
      ...compatibilidadeBase.alertas,
      ...alertasMemoriasAdicionais,
      ...alertasPosicaoVentoinha,
    ];
    // Resultado "não confirmado" do motor entra como alerta, não como erro crítico.
    // A publicação só é bloqueada quando existe erro explícito.
    const compativel = erros.length === 0;
    const status = !compativel
      ? 'INCOMPATIVEL'
      : alertas.length > 0
        ? 'COMPATIVEL_COM_ALERTAS'
        : 'COMPATIVEL';

    return {
      ...compatibilidadeBase,
      compativel,
      status,
      resumo: {
        totalVerificacoes:
          compatibilidadeBase.resumo.totalVerificacoes +
          memoriasAdicionais.length +
          alertasPosicaoVentoinha.length,
        totalErros: erros.length,
        totalAlertas: alertas.length,
      },
      erros,
      alertas,
      memoriasAdicionais,
    };
  }

  private async validarPublicacaoBuild(
    componentes: BuildComponenteDto[],
  ): Promise<void> {
    const compatibilidade =
      await this.analisarCompatibilidadeComponentes(componentes);

    if (compatibilidade.compativel === false) {
      const mensagens = compatibilidade.erros
        .map((erro) => erro.mensagem)
        .filter((mensagem): mensagem is string => Boolean(mensagem));

      throw new BadRequestException(
        mensagens.length > 0
          ? `A build possui incompatibilidades críticas e não pode ser publicada: ${mensagens.join(' | ')}`
          : 'A build possui incompatibilidades críticas e não pode ser publicada.',
      );
    }
  }

  async validarComponentesPublicados(componentes: BuildComponenteDto[]) {
    await this.validarComponentes(componentes, true);
  }

  private async calcularResumoCompra(buildId: number) {
    const agora = new Date();

    const build = await this.prisma.build.findUnique({
      where: { id: buildId },
      select: {
        id: true,
        produtoId: true,
        produto: {
          select: {
            ativo: true,
            publicado: true,
            ofertas: {
              where: {
                status: StatusOferta.ATIVA,
                parceiro: { ativo: true },
                OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
              },
              orderBy: [{ preco: 'asc' }, { id: 'asc' }],
              take: 1,
              select: {
                id: true,
                preco: true,
                frete: true,
                urlOriginal: true,
                urlAfiliada: true,
                parceiro: {
                  select: { id: true, nome: true, slug: true, logoUrl: true },
                },
              },
            },
          },
        },
        componentes: {
          orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
          select: {
            hardwareId: true,
            categoria: true,
            quantidade: true,
            hardware: {
              select: {
                nome: true,
                especificacaoMemoriaRam: {
                  select: { quantidadeModulos: true },
                },
                produto: {
                  select: {
                    ativo: true,
                    publicado: true,
                    ofertas: {
                      where: {
                        status: StatusOferta.ATIVA,
                        parceiro: { ativo: true },
                        OR: [
                          { validoAte: null },
                          { validoAte: { gte: agora } },
                        ],
                      },
                      orderBy: [{ preco: 'asc' }, { id: 'asc' }],
                      take: 1,
                      select: {
                        id: true,
                        preco: true,
                        frete: true,
                        urlOriginal: true,
                        urlAfiliada: true,
                        parceiro: {
                          select: {
                            id: true,
                            nome: true,
                            slug: true,
                            logoUrl: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!build || !build.produto.ativo || !build.produto.publicado) {
      throw new NotFoundException('PC montado não encontrado.');
    }

    let precoPecasParcial = 0;
    let componentesComOferta = 0;

    const itens = build.componentes.map((componente) => {
      const produtoHardware = componente.hardware.produto;
      const oferta =
        produtoHardware?.ativo === true && produtoHardware.publicado === true
          ? (produtoHardware.ofertas[0] ?? null)
          : null;
      const quantidadeComercial = componente.quantidade;
      const quantidadeFisica =
        componente.categoria === CategoriaHardware.MEMORIA_RAM
          ? quantidadeComercial *
            (componente.hardware.especificacaoMemoriaRam?.quantidadeModulos ??
              1)
          : quantidadeComercial;

      const precoUnitario = oferta ? Number(oferta.preco) : null;
      const subtotal =
        precoUnitario === null
          ? null
          : Number((precoUnitario * quantidadeComercial).toFixed(2));

      if (subtotal !== null) {
        precoPecasParcial += subtotal;
        componentesComOferta += 1;
      }

      return {
        hardwareId: componente.hardwareId,
        nome: componente.hardware.nome,
        categoria: componente.categoria,
        quantidadeComercial,
        quantidadeFisica,
        melhorOferta: oferta
          ? {
              id: oferta.id,
              preco: precoUnitario,
              frete: oferta.frete === null ? null : Number(oferta.frete),
              parceiro: oferta.parceiro,
              urlCompra: oferta.urlAfiliada ?? oferta.urlOriginal,
              possuiLinkAfiliado: oferta.urlAfiliada !== null,
            }
          : null,
        subtotal,
      };
    });

    const componentesSemOferta = itens
      .filter((item) => item.melhorOferta === null)
      .map((item) => ({
        hardwareId: item.hardwareId,
        nome: item.nome,
        categoria: item.categoria,
        quantidadeComercial: item.quantidadeComercial,
      }));

    const todosComponentesComOferta = componentesSemOferta.length === 0;
    const precoPecasCompleto = todosComponentesComOferta
      ? Number(precoPecasParcial.toFixed(2))
      : null;

    const ofertaMontado = build.produto.ofertas[0] ?? null;
    const precoMontado = ofertaMontado ? Number(ofertaMontado.preco) : null;

    let comparacao: {
      maisBarato: 'PC_MONTADO' | 'PECAS' | 'EMPATE';
      diferencaReais: number;
      percentualSobrePecas: number;
    } | null = null;

    if (precoMontado !== null && precoPecasCompleto !== null) {
      const diferenca = Number((precoMontado - precoPecasCompleto).toFixed(2));
      const percentual =
        precoPecasCompleto > 0
          ? Number(((diferenca / precoPecasCompleto) * 100).toFixed(2))
          : 0;

      comparacao = {
        maisBarato:
          diferenca < 0 ? 'PC_MONTADO' : diferenca > 0 ? 'PECAS' : 'EMPATE',
        diferencaReais: Math.abs(diferenca),
        percentualSobrePecas: percentual,
      };
    }

    return {
      buildId: build.id,
      produtoId: build.produtoId,
      componentes: {
        totalLinhas: itens.length,
        comOferta: componentesComOferta,
        semOferta: componentesSemOferta.length,
        todosComOferta: todosComponentesComOferta,
      },
      precoPecasParcial: Number(precoPecasParcial.toFixed(2)),
      precoPecasCompleto,
      componentesSemOferta,
      itens,
      melhorOfertaPcMontado: ofertaMontado
        ? {
            id: ofertaMontado.id,
            preco: precoMontado,
            frete:
              ofertaMontado.frete === null ? null : Number(ofertaMontado.frete),
            parceiro: ofertaMontado.parceiro,
            urlCompra: ofertaMontado.urlAfiliada ?? ofertaMontado.urlOriginal,
            possuiLinkAfiliado: ofertaMontado.urlAfiliada !== null,
          }
        : null,
      comparacao,
      observacaoFrete:
        'O total das peças considera apenas os preços dos produtos. Fretes são informados por oferta, mas não são somados porque podem variar por CEP, quantidade e agrupamento do pedido.',
    };
  }

  async resumoCompra(id: number) {
    return this.calcularResumoCompra(id);
  }

  async criar(dados: CriarBuildDto) {
    const componentes = dados.componentes ?? [];
    if (dados.publicado === true) {
      await this.validarPublicacaoBuild(componentes);
    } else {
      await this.validarComponentes(componentes, false);
    }
    const consumo = await this.calcularConsumo(componentes);
    const categoria = await this.garantirCategoria();
    const slug = await this.criarSlugUnico(dados.nome);

    return this.prisma.build.create({
      data: {
        produto: {
          create: {
            categoriaId: categoria.id,
            tipo: TipoProduto.BUILD,
            nome: dados.nome.trim(),
            slug,
            marca: dados.marca?.trim() ?? null,
            modelo: dados.modelo?.trim() ?? null,
            descricao: dados.descricao?.trim() ?? null,
            imagemUrl: dados.imagemUrl?.trim() ?? null,
            imagemHoverUrl: dados.imagemHoverUrl?.trim() ?? null,
            publicado: dados.publicado ?? false,
            ativo: dados.ativo ?? true,

          },
        },
        categoria: dados.categoria?.trim() ?? null,
        finalidade: dados.finalidade?.trim() ?? null,
        resolucaoRecomendada: dados.resolucaoRecomendada?.trim() ?? null,
        configuracao3D: dados.configuracao3D as
          Prisma.InputJsonValue | undefined,
        ...consumo,
        componentes: {
          create: componentes.map((item, indice) => ({
            hardwareId: item.hardwareId,
            categoria: item.categoria,
            quantidade: item.quantidade ?? 1,
            posicao: item.posicao ?? null,
            ordem: item.ordem ?? indice,
          })),
        },
      },
      include: this.includeDetalhado(),
    });
  }

  async listarPublicos(filtros: FiltrarBuildsDto) {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 24;
    const agora = new Date();
    const where: Prisma.BuildWhereInput = {
      produto: {
        ativo: true,
        publicado: true,
        ...(filtros.busca && {
          OR: [
            { nome: { contains: filtros.busca, mode: 'insensitive' } },
            { descricao: { contains: filtros.busca, mode: 'insensitive' } },
          ],
        }),
        ...((filtros.precoMin !== undefined ||
          filtros.precoMax !== undefined ||
          filtros.parceiro !== undefined) && {
          ofertas: {
            some: {
              status: StatusOferta.ATIVA,
              parceiro: {
                ativo: true,
                ...(filtros.parceiro && { slug: filtros.parceiro }),
              },
              preco: {
                ...(filtros.precoMin !== undefined && {
                  gte: filtros.precoMin,
                }),
                ...(filtros.precoMax !== undefined && {
                  lte: filtros.precoMax,
                }),
              },
              OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
            },
          },
        }),
      },
      ...(filtros.uso && {
        finalidade: { contains: filtros.uso, mode: 'insensitive' },
      }),
      ...(filtros.resolucao && {
        resolucaoRecomendada: {
          contains: filtros.resolucao,
          mode: 'insensitive',
        },
      }),
      ...(filtros.categoria && {
        categoria: { contains: filtros.categoria, mode: 'insensitive' },
      }),
    };

    const [total, builds] = await Promise.all([
      this.prisma.build.count({ where }),
      this.prisma.build.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: { atualizadoEm: 'desc' },
        include: this.includeDetalhado(),
      }),
    ]);

    return {
      dados: builds.map((build) => ({
        ...build,
        melhorOferta: build.produto.ofertas[0] ?? null,
      })),
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  async buscarPublico(id: number) {
    const build = await this.prisma.build.findUnique({
      where: { id },
      include: this.includeDetalhado(),
    });
    if (!build || !build.produto.ativo || !build.produto.publicado) {
      throw new NotFoundException('PC montado não encontrado.');
    }
    const [avaliacao, resumoCompra] = await Promise.all([
      this.prisma.avaliacao.aggregate({
        where: {
          produtoId: build.produtoId,
          status: StatusAvaliacao.PUBLICADA,
        },
        _avg: { nota: true },
        _count: { _all: true },
      }),
      this.calcularResumoCompra(build.id),
    ]);

    return {
      ...build,
      avaliacao: {
        media: avaliacao._avg.nota ?? 0,
        quantidade: avaliacao._count._all,
      },
      resumoCompra,
    };
  }

  listarAdmin() {
    return this.prisma.build.findMany({
      orderBy: { atualizadoEm: 'desc' },
      include: this.includeDetalhado(),
    });
  }

  async buscarAdmin(id: number) {
    const build = await this.prisma.build.findUnique({
      where: { id },
      include: this.includeDetalhado(),
    });

    if (!build) {
      throw new NotFoundException('PC montado não encontrado.');
    }

    return build;
  }

  async atualizar(id: number, dados: AtualizarBuildDto) {
    const atual = await this.prisma.build.findUnique({
      where: { id },
      include: { produto: true },
    });
    if (!atual) throw new NotFoundException('PC montado não encontrado.');

    let consumo:
      | { consumoEstimadoWatts: number; fonteRecomendadaWatts: number }
      | undefined;
    if (dados.componentes !== undefined) {
      const ficaraPublicada =
        dados.publicado === true ||
        (dados.publicado === undefined && atual.produto.publicado);

      if (ficaraPublicada) {
        await this.validarPublicacaoBuild(dados.componentes);
      } else {
        await this.validarComponentes(dados.componentes, false);
      }

      consumo = await this.calcularConsumo(dados.componentes);
    } else if (dados.publicado === true && !atual.produto.publicado) {
      const componentesAtuais = await this.prisma.buildComponente.findMany({
        where: { buildId: id },
        select: {
          hardwareId: true,
          categoria: true,
          quantidade: true,
          posicao: true,
          ordem: true,
        },
      });
      await this.validarPublicacaoBuild(componentesAtuais);
    }

    const nome = dados.nome?.trim() ?? atual.produto.nome;
    const slug =
      dados.nome !== undefined
        ? await this.criarSlugUnico(nome, atual.produtoId)
        : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (dados.componentes !== undefined) {
        await tx.buildComponente.deleteMany({ where: { buildId: id } });
        if (dados.componentes.length > 0) {
          await tx.buildComponente.createMany({
            data: dados.componentes.map((item, indice) => ({
              buildId: id,
              hardwareId: item.hardwareId,
              categoria: item.categoria,
              quantidade: item.quantidade ?? 1,
              posicao: item.posicao ?? null,
              ordem: item.ordem ?? indice,
            })),
          });
        }
      }

      await tx.build.update({
        where: { id },
        data: {
          ...(dados.categoria !== undefined && {
            categoria: dados.categoria?.trim() || null,
          }),
          ...(dados.finalidade !== undefined && {
            finalidade: dados.finalidade?.trim() || null,
          }),
          ...(dados.resolucaoRecomendada !== undefined && {
            resolucaoRecomendada: dados.resolucaoRecomendada?.trim() || null,
          }),
          ...(dados.configuracao3D !== undefined && {
            configuracao3D: dados.configuracao3D as Prisma.InputJsonValue,
          }),
          ...(consumo ?? {}),
          produto: {
            update: {
              ...(dados.nome !== undefined && { nome }),
              ...(slug !== undefined && { slug }),
              ...(dados.marca !== undefined && {
                marca: dados.marca?.trim() || null,
              }),
              ...(dados.modelo !== undefined && {
                modelo: dados.modelo?.trim() || null,
              }),
              ...(dados.descricao !== undefined && {
                descricao: dados.descricao?.trim() || null,
              }),
              ...(dados.imagemUrl !== undefined && {
                imagemUrl: dados.imagemUrl?.trim() || null,
              }),
              ...(dados.imagemHoverUrl !== undefined && {
                imagemHoverUrl: dados.imagemHoverUrl?.trim() || null,
              }),
              ...(dados.publicado !== undefined && {
                publicado: dados.publicado,
              }),
              ...(dados.ativo !== undefined && { ativo: dados.ativo }),
            },
          },
        },
      });

      return tx.build.findUniqueOrThrow({
        where: { id },
        include: this.includeDetalhado(),
      });
    });
  }

  async arquivar(id: number) {
    const build = await this.prisma.build.findUnique({
      where: { id },
      select: { produtoId: true },
    });
    if (!build) throw new NotFoundException('PC montado não encontrado.');

    await this.prisma.produto.update({
      where: { id: build.produtoId },
      data: { ativo: false, publicado: false },
    });

    return { mensagem: 'PC montado arquivado com sucesso.' };
  }

  async abrirNo3D(id: number) {
    const build = await this.buscarPublico(id);

    const gabinete = build.componentes.find(
      (componente) => componente.categoria === CategoriaHardware.GABINETE,
    );

    const placaMae = build.componentes.find(
      (componente) => componente.categoria === CategoriaHardware.PLACA_MAE,
    );

    const fonte = build.componentes.find(
      (componente) => componente.categoria === CategoriaHardware.FONTE,
    );

    const cooler = build.componentes.find(
      (componente) => componente.categoria === CategoriaHardware.COOLER,
    );

    if (!gabinete) {
      throw new BadRequestException(
        'A build não possui gabinete para servir como raiz da montagem.',
      );
    }

    if (!placaMae) {
      throw new BadRequestException(
        'A build não possui placa-mãe para gerar a montagem 3D.',
      );
    }

    if (!fonte) {
      throw new BadRequestException(
        'A build não possui fonte para calcular a montagem completa.',
      );
    }

    const [pontosGabinete, pontosPlacaMae] = await Promise.all([
      this.hardwaresService.listarPontosEncaixeHardwarePublico(
        gabinete.hardwareId,
      ),
      this.hardwaresService.listarPontosEncaixeHardwarePublico(
        placaMae.hardwareId,
      ),
    ]);

    const todosPontos = [
      ...pontosGabinete.pontosEncaixe,
      ...pontosPlacaMae.pontosEncaixe,
    ];

    type PontoDisponivel = (typeof todosPontos)[number];

    const pontosOcupados = new Set<number>();

    const reservarPontos = (
      categoria: CategoriaHardware,
      quantidade: number,
      filtro?: (ponto: PontoDisponivel) => boolean,
    ) => {
      const candidatos = todosPontos.filter(
        (ponto) =>
          ponto.categoriaAceita === categoria &&
          !pontosOcupados.has(ponto.id) &&
          (filtro === undefined || filtro(ponto)),
      );

      if (candidatos.length < quantidade) {
        throw new BadRequestException(
          `Não existem pontos de encaixe suficientes para ${quantidade} item(ns) da categoria ${categoria}.`,
        );
      }

      const selecionados = candidatos.slice(0, quantidade);

      for (const ponto of selecionados) {
        pontosOcupados.add(ponto.id);
      }

      return selecionados;
    };

    const itens: Array<{
      instanciaId: string;
      instanciaPaiId?: string;
      pontoEncaixeId: number;
      hardwareFilhoId: number;
    }> = [];

    const obterInstanciaPai = (ponto: PontoDisponivel) => {
      if (ponto.hardwarePaiId === gabinete.hardwareId) {
        return undefined;
      }

      if (ponto.hardwarePaiId === placaMae.hardwareId) {
        return 'placa-mae-1';
      }

      throw new BadRequestException(
        `O ponto ${ponto.codigo} pertence a um hardware pai não previsto para esta montagem.`,
      );
    };

    const pontoPlacaMae = reservarPontos(
      CategoriaHardware.PLACA_MAE,
      1,
      (ponto) => ponto.hardwarePaiId === gabinete.hardwareId,
    )[0];

    itens.push({
      instanciaId: 'placa-mae-1',
      pontoEncaixeId: pontoPlacaMae.id,
      hardwareFilhoId: placaMae.hardwareId,
    });

    const pontoFonte = reservarPontos(
      CategoriaHardware.FONTE,
      1,
      (ponto) => ponto.hardwarePaiId === gabinete.hardwareId,
    )[0];

    itens.push({
      instanciaId: 'fonte-1',
      pontoEncaixeId: pontoFonte.id,
      hardwareFilhoId: fonte.hardwareId,
    });

    if (cooler !== undefined) {
      const pontoCooler = reservarPontos(
        CategoriaHardware.COOLER,
        1,
        (ponto) => ponto.hardwarePaiId === placaMae.hardwareId,
      )[0];

      itens.push({
        instanciaId: 'cooler-1',
        instanciaPaiId: obterInstanciaPai(pontoCooler),
        pontoEncaixeId: pontoCooler.id,
        hardwareFilhoId: cooler.hardwareId,
      });
    }

    let contadorProcessador = 1;

    for (const componente of build.componentes.filter(
      (item) => item.categoria === CategoriaHardware.PROCESSADOR,
    )) {
      const quantidade = componente.quantidade ?? 1;

      const pontos = reservarPontos(
        CategoriaHardware.PROCESSADOR,
        quantidade,
        (ponto) => ponto.hardwarePaiId === placaMae.hardwareId,
      );

      for (const ponto of pontos) {
        itens.push({
          instanciaId: `processador-${contadorProcessador++}`,
          instanciaPaiId: obterInstanciaPai(ponto),
          pontoEncaixeId: ponto.id,
          hardwareFilhoId: componente.hardwareId,
        });
      }
    }

    let contadorRam = 1;

    for (const componente of build.componentes.filter(
      (item) => item.categoria === CategoriaHardware.MEMORIA_RAM,
    )) {
      const quantidadeComercial = componente.quantidade ?? 1;

      const quantidadeModulosPorProduto =
        componente.hardware.especificacaoMemoriaRam?.quantidadeModulos ?? 1;

      const quantidadeFisica =
        quantidadeComercial * quantidadeModulosPorProduto;

      const pontos = reservarPontos(
        CategoriaHardware.MEMORIA_RAM,
        quantidadeFisica,
        (ponto) => ponto.hardwarePaiId === placaMae.hardwareId,
      );

      for (const ponto of pontos) {
        itens.push({
          instanciaId: `ram-${contadorRam++}`,
          instanciaPaiId: obterInstanciaPai(ponto),
          pontoEncaixeId: ponto.id,
          hardwareFilhoId: componente.hardwareId,
        });
      }
    }

    let contadorGpu = 1;

    for (const componente of build.componentes.filter(
      (item) => item.categoria === CategoriaHardware.PLACA_VIDEO,
    )) {
      const quantidade = componente.quantidade ?? 1;

      const pontos = reservarPontos(CategoriaHardware.PLACA_VIDEO, quantidade);

      for (const ponto of pontos) {
        const instanciaPaiId = obterInstanciaPai(ponto);

        itens.push({
          instanciaId: `gpu-${contadorGpu++}`,
          ...(instanciaPaiId !== undefined && { instanciaPaiId }),
          pontoEncaixeId: ponto.id,
          hardwareFilhoId: componente.hardwareId,
        });
      }
    }

    let contadorArmazenamento = 1;

    for (const componente of build.componentes.filter(
      (item) => item.categoria === CategoriaHardware.ARMAZENAMENTO,
    )) {
      const quantidade = componente.quantidade ?? 1;

      const armazenamento = componente.hardware.especificacaoArmazenamento;

      const ehM2 = armazenamento?.formato === 'M2';

      const pontos = reservarPontos(
        CategoriaHardware.ARMAZENAMENTO,
        quantidade,
        (ponto) => {
          const codigo = ponto.codigo.toLowerCase();

          if (ehM2) {
            return (
              ponto.hardwarePaiId === placaMae.hardwareId &&
              codigo.includes('m2')
            );
          }

          return (
            ponto.hardwarePaiId === gabinete.hardwareId &&
            !codigo.includes('m2')
          );
        },
      );

      for (const ponto of pontos) {
        const instanciaPaiId = obterInstanciaPai(ponto);

        itens.push({
          instanciaId: `armazenamento-${contadorArmazenamento++}`,
          ...(instanciaPaiId !== undefined && { instanciaPaiId }),
          pontoEncaixeId: ponto.id,
          hardwareFilhoId: componente.hardwareId,
        });
      }
    }

    const normalizarPosicaoVentoinha = (
      valor: string | null | undefined,
    ): PosicaoRefrigeracaoGabinete | null => {
      const posicao = valor?.trim().toUpperCase();

      switch (posicao) {
        case 'FRENTE':
        case 'FRONTAL':
          return PosicaoRefrigeracaoGabinete.FRENTE;

        case 'TOPO':
        case 'SUPERIOR':
          return PosicaoRefrigeracaoGabinete.TOPO;

        case 'TRASEIRA':
          return PosicaoRefrigeracaoGabinete.TRASEIRA;

        case 'INFERIOR':
          return PosicaoRefrigeracaoGabinete.INFERIOR;

        case 'LATERAL':
          return PosicaoRefrigeracaoGabinete.LATERAL;

        default:
          return null;
      }
    };

    const inferirPosicaoPeloPonto = (
      codigo: string,
    ): PosicaoRefrigeracaoGabinete => {
      const codigoNormalizado = codigo.toLowerCase();

      if (
        codigoNormalizado.includes('frontal') ||
        codigoNormalizado.includes('frente')
      ) {
        return PosicaoRefrigeracaoGabinete.FRENTE;
      }

      if (
        codigoNormalizado.includes('topo') ||
        codigoNormalizado.includes('superior')
      ) {
        return PosicaoRefrigeracaoGabinete.TOPO;
      }

      if (codigoNormalizado.includes('traseir')) {
        return PosicaoRefrigeracaoGabinete.TRASEIRA;
      }

      if (codigoNormalizado.includes('inferior')) {
        return PosicaoRefrigeracaoGabinete.INFERIOR;
      }

      if (codigoNormalizado.includes('lateral')) {
        return PosicaoRefrigeracaoGabinete.LATERAL;
      }

      return PosicaoRefrigeracaoGabinete.FRENTE;
    };

    const pontoCorrespondePosicao = (
      ponto: PontoDisponivel,
      posicao: PosicaoRefrigeracaoGabinete,
    ) => {
      const codigo = ponto.codigo.toLowerCase();

      switch (posicao) {
        case PosicaoRefrigeracaoGabinete.FRENTE:
          return codigo.includes('frontal') || codigo.includes('frente');

        case PosicaoRefrigeracaoGabinete.TOPO:
          return codigo.includes('topo') || codigo.includes('superior');

        case PosicaoRefrigeracaoGabinete.TRASEIRA:
          return codigo.includes('traseir');

        case PosicaoRefrigeracaoGabinete.INFERIOR:
          return codigo.includes('inferior');

        case PosicaoRefrigeracaoGabinete.LATERAL:
          return codigo.includes('lateral');
      }
    };

    const ventoinhas: Array<{
      instanciaId: string;
      ventoinhaId: number;
      posicao: PosicaoRefrigeracaoGabinete;
    }> = [];

    let contadorVentoinha = 1;

    for (const componente of build.componentes.filter(
      (item) => item.categoria === CategoriaHardware.VENTOINHA,
    )) {
      const quantidade = componente.quantidade ?? 1;

      const posicaoInformada = normalizarPosicaoVentoinha(componente.posicao);

      const pontos = reservarPontos(
        CategoriaHardware.VENTOINHA,
        quantidade,
        (ponto) =>
          ponto.hardwarePaiId === gabinete.hardwareId &&
          (posicaoInformada === null ||
            pontoCorrespondePosicao(ponto, posicaoInformada)),
      );

      for (const ponto of pontos) {
        const instanciaId = `ventoinha-${contadorVentoinha++}`;

        itens.push({
          instanciaId,
          pontoEncaixeId: ponto.id,
          hardwareFilhoId: componente.hardwareId,
        });

        ventoinhas.push({
          instanciaId,
          ventoinhaId: componente.hardwareId,
          posicao: posicaoInformada ?? inferirPosicaoPeloPonto(ponto.codigo),
        });
      }
    }

    const montagemCompleta =
      await this.hardwaresService.resolverMontagemCompleta(
        gabinete.hardwareId,
        {
          itens,
          fonteId: fonte.hardwareId,
          ...(cooler !== undefined && {
            coolerId: cooler.hardwareId,
          }),
          ...(ventoinhas.length > 0 && {
            ventoinhas,
          }),
        },
      );

    return {
      buildId: build.id,
      produtoId: build.produtoId,
      configuracao3D: build.configuracao3D,

      componentes: build.componentes.map((componente) => ({
        hardwareId: componente.hardwareId,
        categoria: componente.categoria,
        quantidade: componente.quantidade,
        posicao: componente.posicao,
      })),

      montagemCompleta,
      resumoCompra: build.resumoCompra,

      aviso:
        build.configuracao3D === null
          ? 'A montagem foi resolvida automaticamente a partir dos componentes e pontos de encaixe cadastrados.'
          : null,
    };
  }

  async obterProdutoId(buildId: number) {
    const build = await this.prisma.build.findUnique({
      where: { id: buildId },
      select: { produtoId: true },
    });
    if (!build) throw new NotFoundException('PC montado não encontrado.');
    return build.produtoId;
  }
}
