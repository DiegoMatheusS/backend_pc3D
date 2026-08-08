import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HardwaresService } from '../hardwares/hardwares.service';
import { CategoriaHardware, StatusOferta } from '../generated/prisma/enums';
import { IaProvider } from './ia.provider';
import { ChatIaDto } from './dtos/chat-ia.dto';
import { ChatAdminIaDto } from './dtos/chat-admin-ia.dto';
import { MontarPcIaDto } from './dtos/montar-pc-ia.dto';
import { RecomendarLojaIaDto } from './dtos/recomendar-loja-ia.dto';
import {
  AcaoMontagemGuiadaIa,
  ComponenteSnapshotIaDto,
  EtapaMontagemGuiadaIa,
  MontagemGuiadaIaDto,
  OrigemComponenteIa,
} from './dtos/montagem-guiada-ia.dto';
import {
  AnalisarProdutoIaDto,
  GerarDescricaoIaDto,
  NormalizarProdutoIaDto,
} from './dtos/analisar-produto-ia.dto';
import {
  PROMPT_SISTEMA_PUBLICO,
  PROMPT_SISTEMA_ADMIN,
} from './prompts/prompts';

const LIMITE_HISTORICO = 10;
const TAMANHO_MAXIMO_CATALOGO = 60;

type StatusCompatibilidadeIa =
  | 'COMPATIVEL'
  | 'INCOMPATIVEL'
  | 'COMPATIBILIDADE_PARCIAL'
  | 'DADOS_INSUFICIENTES';

type ResultadoCompatibilidadeIa = {
  status: StatusCompatibilidadeIa;
  erros: string[];
  alertas: string[];
  verificacoesRealizadas: number;
  verificacoesPendentes: number;
};

const ORDEM_ETAPAS_IA: EtapaMontagemGuiadaIa[] = [
  EtapaMontagemGuiadaIa.PROCESSADOR,
  EtapaMontagemGuiadaIa.PLACA_MAE,
  EtapaMontagemGuiadaIa.MEMORIA_RAM,
  EtapaMontagemGuiadaIa.PLACA_VIDEO,
  EtapaMontagemGuiadaIa.ARMAZENAMENTO,
  EtapaMontagemGuiadaIa.FONTE,
  EtapaMontagemGuiadaIa.GABINETE,
  EtapaMontagemGuiadaIa.COOLER,
  EtapaMontagemGuiadaIa.VENTOINHA,
  EtapaMontagemGuiadaIa.RESUMO,
];

const CATEGORIAS_UNITARIAS_IA = new Set<CategoriaHardware>([
  CategoriaHardware.PROCESSADOR,
  CategoriaHardware.PLACA_MAE,
  CategoriaHardware.PLACA_VIDEO,
  CategoriaHardware.FONTE,
  CategoriaHardware.GABINETE,
  CategoriaHardware.COOLER,
]);

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaProvider: IaProvider,
    private readonly hardwaresService: HardwaresService,
  ) {}

  // ─── Utilitários privados ─────────────────────────────────────────────────

  private ehRegistro(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  }

  private textoSpec(
    specs: Record<string, unknown> | undefined,
    chave: string,
  ): string | undefined {
    const valor = specs?.[chave];
    return typeof valor === 'string' && valor.trim().length > 0
      ? valor.trim()
      : undefined;
  }

  private numeroSpec(
    specs: Record<string, unknown> | undefined,
    chave: string,
  ): number | undefined {
    const valor = specs?.[chave];
    return typeof valor === 'number' && Number.isFinite(valor)
      ? valor
      : undefined;
  }

  private booleanoSpec(
    specs: Record<string, unknown> | undefined,
    chave: string,
  ): boolean | undefined {
    const valor = specs?.[chave];
    return typeof valor === 'boolean' ? valor : undefined;
  }

  private listaTextoSpec(
    specs: Record<string, unknown> | undefined,
    chave: string,
  ): string[] {
    const valor = specs?.[chave];
    return Array.isArray(valor)
      ? valor.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
      : [];
  }

  private etapaParaCategoria(
    etapa: EtapaMontagemGuiadaIa,
  ): CategoriaHardware | null {
    if (etapa === EtapaMontagemGuiadaIa.RESUMO) return null;
    return etapa;
  }

  private proximaEtapa(atual: EtapaMontagemGuiadaIa): EtapaMontagemGuiadaIa {
    const indice = ORDEM_ETAPAS_IA.indexOf(atual);
    return ORDEM_ETAPAS_IA[Math.min(indice + 1, ORDEM_ETAPAS_IA.length - 1)];
  }

  private etapaAnterior(atual: EtapaMontagemGuiadaIa): EtapaMontagemGuiadaIa {
    const indice = ORDEM_ETAPAS_IA.indexOf(atual);
    return ORDEM_ETAPAS_IA[Math.max(indice - 1, 0)];
  }

  private adicionarOuSubstituirComponente(
    atuais: ComponenteSnapshotIaDto[],
    novo: ComponenteSnapshotIaDto,
  ): ComponenteSnapshotIaDto[] {
    if (!CATEGORIAS_UNITARIAS_IA.has(novo.categoria)) {
      return [...atuais, { ...novo, quantidade: novo.quantidade ?? 1 }];
    }

    return [
      ...atuais.filter((item) => item.categoria !== novo.categoria),
      { ...novo, quantidade: novo.quantidade ?? 1 },
    ];
  }

  /**
   * Validação técnica para snapshots que ainda não existem no catálogo.
   * Ela só afirma COMPATIVEL quando existem dados suficientes para as relações
   * que podem ser verificadas. Ausência de informação nunca vira "compatível".
   */
  private verificarCompatibilidadeSnapshots(
    componentes: ComponenteSnapshotIaDto[],
    exigirSaidaVideo = false,
  ): ResultadoCompatibilidadeIa {
    const erros: string[] = [];
    const alertas: string[] = [];
    let verificacoesRealizadas = 0;
    let verificacoesPendentes = 0;

    const primeiro = (categoria: CategoriaHardware) =>
      componentes.find((item) => item.categoria === categoria);
    const todos = (categoria: CategoriaHardware) =>
      componentes.filter((item) => item.categoria === categoria);

    const cpu = primeiro(CategoriaHardware.PROCESSADOR);
    const placaMae = primeiro(CategoriaHardware.PLACA_MAE);
    const gpu = primeiro(CategoriaHardware.PLACA_VIDEO);
    const fonte = primeiro(CategoriaHardware.FONTE);
    const gabinete = primeiro(CategoriaHardware.GABINETE);
    const cooler = primeiro(CategoriaHardware.COOLER);
    const memorias = todos(CategoriaHardware.MEMORIA_RAM);
    const armazenamentos = todos(CategoriaHardware.ARMAZENAMENTO);

    if (cpu && placaMae) {
      const socketCpu = this.textoSpec(cpu.especificacoes, 'socket');
      const socketPlaca = this.textoSpec(placaMae.especificacoes, 'socket');
      if (socketCpu && socketPlaca) {
        verificacoesRealizadas++;
        if (socketCpu.toUpperCase() !== socketPlaca.toUpperCase()) {
          erros.push(
            `CPU usa socket ${socketCpu}, mas a placa-mãe usa ${socketPlaca}.`,
          );
        }
      } else {
        verificacoesPendentes++;
        alertas.push(
          'Socket de CPU/placa-mãe incompleto; essa relação ainda não pode ser confirmada.',
        );
      }
    }

    if (placaMae && memorias.length > 0) {
      const tiposSuportados = this.listaTextoSpec(
        placaMae.especificacoes,
        'tiposMemoriaSuportados',
      ).map((item) => item.toUpperCase());
      const formatosSuportados = this.listaTextoSpec(
        placaMae.especificacoes,
        'formatosMemoriaSuportados',
      ).map((item) => item.toUpperCase());
      const slotsMemoria = this.numeroSpec(
        placaMae.especificacoes,
        'slotsMemoria',
      );
      const capacidadeMaxima = this.numeroSpec(
        placaMae.especificacoes,
        'capacidadeMaximaMemoriaGb',
      );

      let modulosTotais = 0;
      let capacidadeTotal = 0;
      let dadosCapacidadeCompletos = true;

      for (const memoria of memorias) {
        const tipo = this.textoSpec(memoria.especificacoes, 'tipo');
        const formato = this.textoSpec(memoria.especificacoes, 'formato');
        const capacidade = this.numeroSpec(
          memoria.especificacoes,
          'capacidadePorModuloGb',
        );
        const modulosPorKit =
          this.numeroSpec(memoria.especificacoes, 'quantidadeModulos') ?? 1;
        const quantidadeKits = memoria.quantidade ?? 1;

        modulosTotais += modulosPorKit * quantidadeKits;
        if (capacidade !== undefined) {
          capacidadeTotal += capacidade * modulosPorKit * quantidadeKits;
        } else {
          dadosCapacidadeCompletos = false;
        }

        if (tipo && tiposSuportados.length > 0) {
          verificacoesRealizadas++;
          if (!tiposSuportados.includes(tipo.toUpperCase())) {
            erros.push(
              `A memória ${memoria.nome} é ${tipo}, não suportada pela placa-mãe selecionada.`,
            );
          }
        } else {
          verificacoesPendentes++;
          alertas.push(`Tipo de memória não confirmado para ${memoria.nome}.`);
        }

        if (formato && formatosSuportados.length > 0) {
          verificacoesRealizadas++;
          if (!formatosSuportados.includes(formato.toUpperCase())) {
            erros.push(
              `O formato ${formato} de ${memoria.nome} não é suportado pela placa-mãe.`,
            );
          }
        }
      }

      if (slotsMemoria !== undefined) {
        verificacoesRealizadas++;
        if (modulosTotais > slotsMemoria) {
          erros.push(
            `A build usa ${modulosTotais} módulos de RAM, mas a placa-mãe possui ${slotsMemoria} slots.`,
          );
        }
      }

      if (capacidadeMaxima !== undefined && dadosCapacidadeCompletos) {
        verificacoesRealizadas++;
        if (capacidadeTotal > capacidadeMaxima) {
          erros.push(
            `A build soma ${capacidadeTotal} GB de RAM, acima do limite de ${capacidadeMaxima} GB da placa-mãe.`,
          );
        }
      }
    }

    if (placaMae && gabinete) {
      const formatoPlaca = this.textoSpec(placaMae.especificacoes, 'formato');
      const formatosGabinete = this.listaTextoSpec(
        gabinete.especificacoes,
        'formatosPlacaMaeSuportados',
      ).map((item) => item.toUpperCase());
      if (formatoPlaca && formatosGabinete.length > 0) {
        verificacoesRealizadas++;
        if (!formatosGabinete.includes(formatoPlaca.toUpperCase())) {
          erros.push(
            `O gabinete não suporta placa-mãe no formato ${formatoPlaca}.`,
          );
        }
      } else {
        verificacoesPendentes++;
      }
    }

    if (gpu && gabinete) {
      const comprimentoGpu = this.numeroSpec(
        gpu.especificacoes,
        'comprimentoMm',
      );
      const maxGpu = this.numeroSpec(
        gabinete.especificacoes,
        'comprimentoMaximoGpuMm',
      );
      if (comprimentoGpu !== undefined && maxGpu !== undefined) {
        verificacoesRealizadas++;
        if (comprimentoGpu > maxGpu) {
          erros.push(
            `A GPU possui ${comprimentoGpu} mm e excede o limite de ${maxGpu} mm do gabinete.`,
          );
        }
      } else {
        verificacoesPendentes++;
      }

      const slotsGpu = this.numeroSpec(gpu.especificacoes, 'slotsOcupados');
      const slotsMax = this.numeroSpec(
        gabinete.especificacoes,
        'slotsMaximosGpu',
      );
      if (slotsGpu !== undefined && slotsMax !== undefined) {
        verificacoesRealizadas++;
        if (slotsGpu > slotsMax) {
          erros.push(
            `A GPU ocupa ${slotsGpu} slots e o gabinete suporta até ${slotsMax}.`,
          );
        }
      }
    }

    if (fonte && gabinete) {
      const formatoFonte = this.textoSpec(fonte.especificacoes, 'formato');
      const formatosFonteGabinete = this.listaTextoSpec(
        gabinete.especificacoes,
        'formatosFonteSuportados',
      ).map((item) => item.toUpperCase());
      if (formatoFonte && formatosFonteGabinete.length > 0) {
        verificacoesRealizadas++;
        if (!formatosFonteGabinete.includes(formatoFonte.toUpperCase())) {
          erros.push(
            `A fonte no formato ${formatoFonte} não é suportada pelo gabinete.`,
          );
        }
      }
    }

    if (gpu && fonte) {
      const potenciaFonte = this.numeroSpec(
        fonte.especificacoes,
        'potenciaWatts',
      );
      const recomendadaGpu = this.numeroSpec(
        gpu.especificacoes,
        'potenciaFonteRecomendadaWatts',
      );
      if (potenciaFonte !== undefined && recomendadaGpu !== undefined) {
        verificacoesRealizadas++;
        if (potenciaFonte < recomendadaGpu) {
          erros.push(
            `A GPU recomenda fonte de ${recomendadaGpu} W, mas a fonte selecionada possui ${potenciaFonte} W.`,
          );
        }
      } else {
        verificacoesPendentes++;
      }
    }

    if (cpu && cooler) {
      const socketCpu = this.textoSpec(cpu.especificacoes, 'socket');
      const socketsCooler = this.listaTextoSpec(
        cooler.especificacoes,
        'socketsSuportados',
      ).map((item) => item.toUpperCase());
      if (socketCpu && socketsCooler.length > 0) {
        verificacoesRealizadas++;
        if (!socketsCooler.includes(socketCpu.toUpperCase())) {
          erros.push(
            `O cooler não informa suporte ao socket ${socketCpu} da CPU.`,
          );
        }
      } else {
        verificacoesPendentes++;
      }

      const tdpCpu = this.numeroSpec(cpu.especificacoes, 'tdpWatts');
      const capacidadeCooler = this.numeroSpec(
        cooler.especificacoes,
        'capacidadeTermicaWatts',
      );
      if (tdpCpu !== undefined && capacidadeCooler !== undefined) {
        verificacoesRealizadas++;
        if (capacidadeCooler < tdpCpu) {
          erros.push(
            `O cooler suporta ${capacidadeCooler} W, abaixo do TDP informado da CPU (${tdpCpu} W).`,
          );
        }
      }
    }

    if (cooler && gabinete) {
      const tipoCooler = this.textoSpec(cooler.especificacoes, 'tipo');
      const alturaCooler = this.numeroSpec(cooler.especificacoes, 'alturaMm');
      const alturaMax = this.numeroSpec(
        gabinete.especificacoes,
        'alturaMaximaCoolerCpuMm',
      );
      if (
        tipoCooler === 'AIR_COOLER' &&
        alturaCooler !== undefined &&
        alturaMax !== undefined
      ) {
        verificacoesRealizadas++;
        if (alturaCooler > alturaMax) {
          erros.push(
            `O cooler possui ${alturaCooler} mm de altura e excede o limite de ${alturaMax} mm do gabinete.`,
          );
        }
      }
    }

    if (placaMae && armazenamentos.length > 0) {
      const portasSata = this.numeroSpec(placaMae.especificacoes, 'portasSata');
      const slotsM2Raw = placaMae.especificacoes?.['slotsM2'];
      const slotsM2 = Array.isArray(slotsM2Raw) ? slotsM2Raw.length : undefined;
      let usadosSata = 0;
      let usadosM2 = 0;
      for (const armazenamento of armazenamentos) {
        const formato = this.textoSpec(armazenamento.especificacoes, 'formato');
        const interfaceArmazenamento = this.textoSpec(
          armazenamento.especificacoes,
          'interface',
        );
        const quantidade = armazenamento.quantidade ?? 1;
        if (formato === 'M2') usadosM2 += quantidade;
        if (interfaceArmazenamento === 'SATA' && formato !== 'M2') {
          usadosSata += quantidade;
        }
      }
      if (portasSata !== undefined) {
        verificacoesRealizadas++;
        if (usadosSata > portasSata) {
          erros.push(
            `A build precisa de ${usadosSata} portas SATA e a placa-mãe possui ${portasSata}.`,
          );
        }
      }
      if (slotsM2 !== undefined) {
        verificacoesRealizadas++;
        if (usadosM2 > slotsM2) {
          erros.push(
            `A build usa ${usadosM2} unidades M.2 e a placa-mãe possui ${slotsM2} slots M.2.`,
          );
        }
      }
    }

    if (exigirSaidaVideo && cpu && !gpu) {
      const videoIntegrado = this.booleanoSpec(
        cpu.especificacoes,
        'possuiVideoIntegrado',
      );
      if (videoIntegrado === false) {
        verificacoesRealizadas++;
        erros.push(
          'A CPU informa que não possui vídeo integrado e nenhuma placa de vídeo foi selecionada.',
        );
      } else if (videoIntegrado === undefined) {
        verificacoesPendentes++;
        alertas.push(
          'Não foi possível confirmar se a CPU possui vídeo integrado; sem GPU dedicada, confirme esse dado antes de concluir.',
        );
      }
    }

    let status: StatusCompatibilidadeIa;
    if (erros.length > 0) {
      status = 'INCOMPATIVEL';
    } else if (verificacoesRealizadas === 0) {
      status = 'DADOS_INSUFICIENTES';
    } else if (verificacoesPendentes > 0) {
      status = 'COMPATIBILIDADE_PARCIAL';
    } else {
      status = 'COMPATIVEL';
    }

    return {
      status,
      erros,
      alertas,
      verificacoesRealizadas,
      verificacoesPendentes,
    };
  }

  private async carregarOpcoesMontagemGuiada(
    categoria: CategoriaHardware,
    componentesAtuais: ComponenteSnapshotIaDto[],
    filtro?: string,
    pagina = 0,
  ) {
    const agora = new Date();
    const candidatos = await this.prisma.hardware.findMany({
      where: {
        ativo: true,
        publicado: true,
        categoria,
        ...(filtro?.trim()
          ? {
              OR: [
                { nome: { contains: filtro.trim(), mode: 'insensitive' } },
                { marca: { contains: filtro.trim(), mode: 'insensitive' } },
                { modelo: { contains: filtro.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
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
        },
        produto: {
          select: {
            ofertas: {
              where: {
                status: StatusOferta.ATIVA,
                parceiro: { ativo: true },
                OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
              },
              orderBy: { preco: 'asc' },
              take: 1,
              select: { preco: true },
            },
          },
        },
      },
      orderBy: [{ marca: 'asc' }, { nome: 'asc' }],
      take: 80,
    });

    const opcoes = candidatos.flatMap((hardware) => {
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

      const especificacoes = this.ehRegistro(especificacoesTecnicas)
        ? { ...especificacoesTecnicas }
        : undefined;

      const snapshot: ComponenteSnapshotIaDto = {
        categoria: hardware.categoria,
        hardwareId: hardware.id,
        nome: hardware.nome,
        marca: hardware.marca,
        modelo: hardware.modelo,
        imagemUrl: hardware.imagemUrl ?? undefined,
        modelo3dUrl: hardware.modelos3D[0]?.arquivoUrl,
        quantidade: 1,
        origem: OrigemComponenteIa.CATALOGO,
        especificacoes,
      };

      const estadoComCandidato = this.adicionarOuSubstituirComponente(
        componentesAtuais,
        snapshot,
      );
      const compatibilidade =
        this.verificarCompatibilidadeSnapshots(estadoComCandidato);

      if (compatibilidade.status === 'INCOMPATIVEL') return [];

      const preco = hardware.produto?.ofertas[0]
        ? Number(hardware.produto.ofertas[0].preco)
        : null;

      return [
        {
          id: `hardware:${hardware.id}`,
          tipo: 'HARDWARE' as const,
          titulo: hardware.nome,
          subtitulo: `${hardware.marca} ${hardware.modelo}`.trim(),
          categoria: hardware.categoria,
          hardwareId: hardware.id,
          imagemUrl: hardware.imagemUrl,
          preco,
          compravel: preco !== null,
          origem: OrigemComponenteIa.CATALOGO,
          compatibilidade: compatibilidade.status,
          possuiModelo3D: hardware.modelos3D.length > 0,
          selecao: snapshot,
        },
      ];
    });

    const tamanhoPagina = 6;
    const inicio = pagina * tamanhoPagina;
    return {
      opcoes: opcoes.slice(inicio, inicio + tamanhoPagina),
      temMais: inicio + tamanhoPagina < opcoes.length,
      totalCompativeisConhecidos: opcoes.length,
    };
  }

  private extrairFiltrosRapidosCpu(
    opcoes: Array<{ titulo: string; subtitulo: string }>,
  ): string[] {
    const padroes = [
      /Ryzen\s+[3579]/i,
      /Core\s+Ultra\s+[579]/i,
      /Core\s+i[3579]/i,
    ];
    const encontrados = new Set<string>();
    for (const opcao of opcoes) {
      const texto = `${opcao.titulo} ${opcao.subtitulo}`;
      for (const padrao of padroes) {
        const match = texto.match(padrao)?.[0];
        if (match) encontrados.add(match.replace(/\s+/g, ' ').trim());
      }
    }
    return [...encontrados].slice(0, 8);
  }

  private async validarEstadoComMotorOficial(
    componentes: ComponenteSnapshotIaDto[],
    exigirSaidaVideo = false,
  ): Promise<ResultadoCompatibilidadeIa> {
    const snapshot = this.verificarCompatibilidadeSnapshots(
      componentes,
      exigirSaidaVideo,
    );
    if (snapshot.status === 'INCOMPATIVEL') return snapshot;

    const primeiro = (categoria: CategoriaHardware) =>
      componentes.find(
        (item) => item.categoria === categoria && item.hardwareId !== undefined,
      );
    const todos = (categoria: CategoriaHardware) =>
      componentes.filter(
        (item) => item.categoria === categoria && item.hardwareId !== undefined,
      );

    const cpu = primeiro(CategoriaHardware.PROCESSADOR);
    const placaMae = primeiro(CategoriaHardware.PLACA_MAE);
    const gabinete = primeiro(CategoriaHardware.GABINETE);
    const fonte = primeiro(CategoriaHardware.FONTE);
    const memorias = todos(CategoriaHardware.MEMORIA_RAM);

    const existeExterno = componentes.some(
      (item) => item.hardwareId === undefined,
    );
    if (
      existeExterno ||
      !cpu?.hardwareId ||
      !placaMae?.hardwareId ||
      !gabinete?.hardwareId ||
      !fonte?.hardwareId ||
      memorias.length === 0
    ) {
      return snapshot;
    }

    try {
      const memoriaPrincipal = memorias[0];
      if (!memoriaPrincipal.hardwareId) return snapshot;

      const quantidadeModulosRamTotal = memorias.reduce((total, memoria) => {
        const modulos =
          this.numeroSpec(memoria.especificacoes, 'quantidadeModulos') ?? 1;
        return total + modulos * (memoria.quantidade ?? 1);
      }, 0);

      const resultado =
        await this.hardwaresService.verificarCompatibilidadeMontagem({
          placaMaeId: placaMae.hardwareId,
          processadorId: cpu.hardwareId,
          memoriaRamId: memoriaPrincipal.hardwareId,
          quantidadeModulosRam:
            (this.numeroSpec(
              memoriaPrincipal.especificacoes,
              'quantidadeModulos',
            ) ?? 1) * (memoriaPrincipal.quantidade ?? 1),
          quantidadeModulosRamTotal,
          gabineteId: gabinete.hardwareId,
          fonteId: fonte.hardwareId,
          placaVideoId: primeiro(CategoriaHardware.PLACA_VIDEO)?.hardwareId,
          coolerId: primeiro(CategoriaHardware.COOLER)?.hardwareId,
          armazenamentoIds: todos(CategoriaHardware.ARMAZENAMENTO).flatMap(
            (item) => (item.hardwareId ? [item.hardwareId] : []),
          ),
        });

      return {
        status: !resultado.compativel
          ? 'INCOMPATIVEL'
          : resultado.confirmado && resultado.alertas.length === 0
            ? 'COMPATIVEL'
            : 'COMPATIBILIDADE_PARCIAL',
        erros: resultado.erros.map((erro) => erro.mensagem),
        alertas: resultado.alertas.map((alerta) => alerta.mensagem),
        verificacoesRealizadas: resultado.resumo.totalVerificacoes,
        verificacoesPendentes: resultado.resumo.totalNaoConfirmados,
      };
    } catch {
      return {
        ...snapshot,
        status:
          snapshot.status === 'COMPATIVEL'
            ? 'COMPATIBILIDADE_PARCIAL'
            : snapshot.status,
        alertas: [
          ...snapshot.alertas,
          'O motor oficial não conseguiu concluir a validação desta combinação.',
        ],
        verificacoesPendentes: snapshot.verificacoesPendentes + 1,
      };
    }
  }

  private async resumirCompraMontagemIa(
    componentes: ComponenteSnapshotIaDto[],
  ) {
    const ids = [
      ...new Set(
        componentes.flatMap((item) =>
          item.hardwareId !== undefined ? [item.hardwareId] : [],
        ),
      ),
    ];

    const hardwares = ids.length
      ? await this.prisma.hardware.findMany({
          where: { id: { in: ids }, ativo: true, publicado: true },
          select: {
            id: true,
            produto: {
              select: {
                ofertas: {
                  where: {
                    status: StatusOferta.ATIVA,
                    parceiro: { ativo: true },
                    OR: [
                      { validoAte: null },
                      { validoAte: { gte: new Date() } },
                    ],
                  },
                  orderBy: { preco: 'asc' },
                  take: 1,
                  select: { preco: true },
                },
              },
            },
          },
        })
      : [];

    const precoPorHardware = new Map<number, number | null>(
      hardwares.map((hardware): [number, number | null] => [
        hardware.id,
        hardware.produto?.ofertas[0]
          ? Number(hardware.produto.ofertas[0].preco)
          : null,
      ]),
    );

    let total = 0;
    let completo = componentes.length > 0;
    const itens = componentes.map((item) => {
      const precoUnitario =
        item.hardwareId !== undefined
          ? (precoPorHardware.get(item.hardwareId) ?? null)
          : null;
      const quantidade = item.quantidade ?? 1;
      const compravel = item.hardwareId !== undefined && precoUnitario !== null;
      if (!compravel) completo = false;
      if (precoUnitario !== null) total += precoUnitario * quantidade;
      return {
        categoria: item.categoria,
        nome: item.nome,
        hardwareId: item.hardwareId ?? null,
        origem: item.origem,
        quantidade,
        precoUnitario,
        subtotal:
          precoUnitario === null
            ? null
            : Number((precoUnitario * quantidade).toFixed(2)),
        compravel,
        motivoIndisponivel: compravel
          ? null
          : item.hardwareId === undefined
            ? 'Peça não cadastrada no catálogo; não há compra/oferta disponível.'
            : 'Hardware sem oferta ativa no momento.',
      };
    });

    return {
      completo,
      valorTotal: Number(total.toFixed(2)),
      itens,
    };
  }

  private async carregarCatalogoCurto() {
    const hardwares = await this.prisma.hardware.findMany({
      where: { ativo: true, publicado: true },
      select: {
        id: true,
        nome: true,
        marca: true,
        modelo: true,
        categoria: true,
        especificacoes: true,
        especificacaoProcessador: {
          select: {
            socket: true,
            tdpWatts: true,
            nucleos: true,
            threads: true,
          },
        },
        especificacaoPlacaMae: {
          select: {
            socket: true,
            formato: true,
            tiposMemoriaSuportados: true,
            slotsMemoria: true,
          },
        },
        especificacaoMemoriaRam: {
          select: {
            tipo: true,
            capacidadePorModuloGb: true,
            quantidadeModulos: true,
            frequenciaMhz: true,
          },
        },
        especificacaoPlacaVideo: {
          select: {
            memoriaVideoGb: true,
            comprimentoMm: true,
            consumoWatts: true,
          },
        },
        especificacaoFonte: {
          select: { potenciaWatts: true, formato: true },
        },
        especificacaoGabinete: {
          select: {
            tamanho: true,
            formatosPlacaMaeSuportados: true,
            comprimentoMaximoGpuMm: true,
          },
        },
        especificacaoCooler: {
          select: { capacidadeTermicaWatts: true },
        },
        especificacaoArmazenamento: {
          select: { capacidadeGb: true, interface: true, formato: true },
        },
        ofertas: {
          where: {
            status: StatusOferta.ATIVA,
            parceiro: { ativo: true },
            OR: [{ validoAte: null }, { validoAte: { gte: new Date() } }],
          },
          orderBy: { preco: 'asc' },
          take: 1,
          select: { preco: true, atualizadoEm: true },
        },
      },
      take: TAMANHO_MAXIMO_CATALOGO,
      orderBy: { nome: 'asc' },
    });

    return hardwares;
  }

  private formatarCatalogoParaPrompt(
    hardwares: Awaited<ReturnType<typeof this.carregarCatalogoCurto>>,
  ): string {
    return hardwares
      .map((h) => {
        const melhorOferta = h.ofertas[0];
        const preco = melhorOferta
          ? Number(melhorOferta.preco).toFixed(2)
          : '?';

        const specs =
          h.especificacaoProcessador ??
          h.especificacaoPlacaMae ??
          h.especificacaoMemoriaRam ??
          h.especificacaoPlacaVideo ??
          h.especificacaoFonte ??
          h.especificacaoGabinete ??
          h.especificacaoCooler ??
          h.especificacaoArmazenamento;

        return `- [ID:${h.id}] ${h.nome} | Categoria: ${h.categoria} | Preço: R$ ${preco} | Specs: ${JSON.stringify(specs ?? {})}`;
      })
      .join('\n');
  }

  private construirHistoricoParaGemini(historico: ChatIaDto['historico'] = []) {
    return historico.slice(-LIMITE_HISTORICO).map((msg) => ({
      role: msg.papel === 'usuario' ? ('user' as const) : ('model' as const),
      parts: [{ text: msg.conteudo }],
    }));
  }

  private async gerarRespostaChat(
    promptSistema: string,
    historico: ChatIaDto['historico'],
    mensagemAtual: string,
    contextoExtra = '',
  ): Promise<string> {
    const modelo = this.iaProvider.obterModelo();

    const historicoFormatado = this.construirHistoricoParaGemini(historico);

    const chat = modelo.startChat({
      history: [
        {
          role: 'user',
          parts: [
            {
              text: `${promptSistema}${contextoExtra ? `\n\nCONTEXTO ADICIONAL:\n${contextoExtra}` : ''}`,
            },
          ],
        },
        {
          role: 'model',
          parts: [
            {
              text: 'Entendido. Estou pronto para ajudar com as regras e o contexto fornecidos.',
            },
          ],
        },
        ...historicoFormatado,
      ],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.4,
      },
    });

    const resultado = await chat.sendMessage(mensagemAtual);
    return resultado.response.text();
  }

  private async carregarProdutoParaIa(identificador: {
    hardwareId?: number;
    produtoId?: number;
  }) {
    if (
      (identificador.hardwareId === undefined &&
        identificador.produtoId === undefined) ||
      (identificador.hardwareId !== undefined &&
        identificador.produtoId !== undefined)
    ) {
      throw new BadRequestException(
        'Informe produtoId ou hardwareId, mas não os dois ao mesmo tempo.',
      );
    }

    let produtoId = identificador.produtoId;
    if (identificador.hardwareId !== undefined) {
      const hardware = await this.prisma.hardware.findUnique({
        where: { id: identificador.hardwareId },
        select: { produtoId: true },
      });
      if (!hardware?.produtoId) {
        throw new NotFoundException(
          'Hardware não encontrado ou ainda não vinculado ao catálogo da Loja.',
        );
      }
      produtoId = hardware.produtoId;
    }

    if (produtoId === undefined) {
      throw new NotFoundException('Produto não encontrado.');
    }

    const produto = await this.prisma.produto.findUnique({
      where: { id: produtoId },
      include: {
        categoria: true,
        especificacaoMonitor: true,
        especificacaoMouse: true,
        especificacaoTeclado: true,
        especificacaoHeadset: true,
        notebook: { include: { especificacao: true } },
        build: {
          include: {
            componentes: {
              include: {
                hardware: {
                  select: { id: true, nome: true, categoria: true },
                },
              },
            },
          },
        },
        hardware: {
          include: {
            especificacaoProcessador: true,
            especificacaoPlacaMae: { include: { slotsM2: true } },
            especificacaoMemoriaRam: true,
            especificacaoGabinete: {
              include: { suportesFans: true, suportesRadiador: true },
            },
            especificacaoFonte: true,
            especificacaoPlacaVideo: true,
            especificacaoCooler: true,
            especificacaoVentoinha: true,
            especificacaoArmazenamento: true,
          },
        },
      },
    });

    if (!produto) {
      throw new NotFoundException('Produto não encontrado.');
    }

    return produto;
  }

  private async normalizarSelecaoMontagemGuiada(
    selecao: ComponenteSnapshotIaDto,
  ): Promise<ComponenteSnapshotIaDto> {
    if (selecao.hardwareId !== undefined) {
      const hardware = await this.hardwaresService.buscarPublicadoPorId(
        selecao.hardwareId,
      );
      if (hardware.categoria !== selecao.categoria) {
        throw new BadRequestException(
          'A categoria selecionada não corresponde ao Hardware informado.',
        );
      }

      return {
        categoria: hardware.categoria,
        hardwareId: hardware.id,
        nome: hardware.nome,
        marca: hardware.marca,
        modelo: hardware.modelo,
        imagemUrl: hardware.imagemUrl ?? undefined,
        modelo3dUrl: hardware.modelos3D[0]?.arquivoUrl,
        quantidade: selecao.quantidade ?? 1,
        origem: OrigemComponenteIa.CATALOGO,
        especificacoes: this.ehRegistro(hardware.especificacoes)
          ? hardware.especificacoes
          : undefined,
      };
    }

    if (selecao.origem === OrigemComponenteIa.CATALOGO) {
      throw new BadRequestException(
        'Uma peça do catálogo precisa informar hardwareId.',
      );
    }

    return {
      ...selecao,
      hardwareId: undefined,
      nome: selecao.nome.trim(),
      marca: selecao.marca?.trim() || undefined,
      modelo: selecao.modelo?.trim() || undefined,
      quantidade: selecao.quantidade ?? 1,
    };
  }

  private mensagemEtapaMontagem(etapa: EtapaMontagemGuiadaIa): string {
    const mensagens: Record<EtapaMontagemGuiadaIa, string> = {
      PROCESSADOR:
        'Escolha o processador. Você pode filtrar por família ou informar uma peça que ainda não esteja no catálogo.',
      PLACA_MAE:
        'Agora escolha a placa-mãe. Opções incompatíveis conhecidas são removidas da lista.',
      MEMORIA_RAM:
        'Escolha a memória RAM. O backend verifica tipo, formato, slots e capacidade quando esses dados estão disponíveis.',
      PLACA_VIDEO:
        'Escolha uma placa de vídeo ou pule esta etapa se não precisar de GPU dedicada.',
      ARMAZENAMENTO:
        'Escolha o armazenamento. Você pode adicionar mais de uma unidade.',
      FONTE:
        'Escolha a fonte. Potência, formato e requisitos conhecidos serão verificados.',
      GABINETE:
        'Escolha o gabinete. Formato da placa-mãe e dimensões conhecidas serão conferidos.',
      COOLER: 'Escolha o cooler ou pule se a solução atual já for suficiente.',
      VENTOINHA: 'Adicione ventoinhas se desejar ou avance para o resumo.',
      RESUMO:
        'A configuração está pronta para revisão. Peças fora do catálogo podem permanecer na build, mas não possuem compra/oferta.',
    };
    return mensagens[etapa];
  }

  // ─── Endpoints públicos ───────────────────────────────────────────────────

  async chat(dados: ChatIaDto): Promise<{
    resposta: string;
    fluxoGuiado?: Awaited<ReturnType<IaService['montagemGuiada']>>;
  }> {
    const pedeMontagem =
      /(?:quero|vamos|preciso|me ajuda|ajude).*montar.*(?:pc|computador)|montar\s+(?:um\s+)?(?:pc|computador)/i.test(
        dados.mensagem,
      );

    if (pedeMontagem) {
      const fluxoGuiado = await this.montagemGuiada({
        acao: AcaoMontagemGuiadaIa.INICIAR,
        componentes: [],
        orcamento: dados.orcamento,
        uso: dados.uso,
      });
      return {
        resposta:
          'Vamos montar por etapas. Começamos pelo processador; você pode escolher uma opção, filtrar, informar uma peça fora do catálogo ou deixar o sistema decidir.',
        fluxoGuiado,
      };
    }

    const contextoPartes: string[] = [];

    if (dados.buildAtual && Object.keys(dados.buildAtual).length > 0) {
      contextoPartes.push(
        `Build atual do usuário no montador: ${JSON.stringify(dados.buildAtual)}`,
      );
    }

    const resposta = await this.gerarRespostaChat(
      PROMPT_SISTEMA_PUBLICO,
      dados.historico ?? [],
      dados.mensagem,
      contextoPartes.join('\n'),
    );

    return { resposta };
  }

  async montagemGuiada(dados: MontagemGuiadaIaDto) {
    let componentes = [...(dados.componentes ?? [])];
    let etapa =
      dados.acao === AcaoMontagemGuiadaIa.INICIAR
        ? EtapaMontagemGuiadaIa.PROCESSADOR
        : (dados.etapaAtual ?? EtapaMontagemGuiadaIa.PROCESSADOR);
    let pagina = dados.pagina ?? 0;

    if (dados.acao === AcaoMontagemGuiadaIa.VOLTAR) {
      etapa = this.etapaAnterior(etapa);
      pagina = 0;
    }

    if (dados.acao === AcaoMontagemGuiadaIa.PULAR) {
      const permitidas = new Set<EtapaMontagemGuiadaIa>([
        EtapaMontagemGuiadaIa.PLACA_VIDEO,
        EtapaMontagemGuiadaIa.COOLER,
        EtapaMontagemGuiadaIa.VENTOINHA,
      ]);
      if (!permitidas.has(etapa)) {
        throw new BadRequestException(
          `A etapa ${etapa} é necessária para uma build completa e não deve ser pulada.`,
        );
      }
      etapa = this.proximaEtapa(etapa);
      pagina = 0;
    }

    if (dados.acao === AcaoMontagemGuiadaIa.SELECIONAR) {
      if (!dados.selecao) {
        throw new BadRequestException('Informe a peça selecionada.');
      }
      const categoriaEtapa = this.etapaParaCategoria(etapa);
      if (categoriaEtapa && dados.selecao.categoria !== categoriaEtapa) {
        throw new BadRequestException(
          `A etapa atual espera ${categoriaEtapa}, mas foi enviada ${dados.selecao.categoria}.`,
        );
      }
      const selecao = await this.normalizarSelecaoMontagemGuiada(dados.selecao);
      componentes = this.adicionarOuSubstituirComponente(componentes, selecao);
      etapa = this.proximaEtapa(etapa);
      pagina = 0;
    }

    if (dados.acao === AcaoMontagemGuiadaIa.VER_MAIS) {
      pagina += 1;
    }

    if (dados.acao === AcaoMontagemGuiadaIa.FILTRAR) {
      pagina = 0;
    }

    let dadosOpcoes = {
      opcoes: [] as Awaited<
        ReturnType<IaService['carregarOpcoesMontagemGuiada']>
      >['opcoes'],
      temMais: false,
      totalCompativeisConhecidos: 0,
    };

    const categoriaAtual = this.etapaParaCategoria(etapa);
    if (categoriaAtual) {
      dadosOpcoes = await this.carregarOpcoesMontagemGuiada(
        categoriaAtual,
        componentes,
        dados.filtro,
        pagina,
      );
    }

    if (dados.acao === AcaoMontagemGuiadaIa.IA_DECIDIR) {
      const escolha = dadosOpcoes.opcoes[0]?.selecao;
      if (!escolha) {
        throw new BadRequestException(
          'Não existe opção conhecida e compatível no catálogo para esta etapa. Informe uma peça manualmente ou fora do catálogo.',
        );
      }
      componentes = this.adicionarOuSubstituirComponente(componentes, escolha);
      etapa = this.proximaEtapa(etapa);
      pagina = 0;
      const proximaCategoria = this.etapaParaCategoria(etapa);
      dadosOpcoes = proximaCategoria
        ? await this.carregarOpcoesMontagemGuiada(
            proximaCategoria,
            componentes,
            undefined,
            0,
          )
        : {
            opcoes: [],
            temMais: false,
            totalCompativeisConhecidos: 0,
          };
    }

    const compatibilidade = await this.validarEstadoComMotorOficial(
      componentes,
      etapa === EtapaMontagemGuiadaIa.RESUMO,
    );
    const compra = await this.resumirCompraMontagemIa(componentes);

    const filtrosRapidos =
      etapa === EtapaMontagemGuiadaIa.PROCESSADOR
        ? this.extrairFiltrosRapidosCpu(dadosOpcoes.opcoes)
        : [];

    const componentesResposta = componentes.map((item) => ({
      ...item,
      hardwareId: item.hardwareId ?? null,
      compravel:
        item.hardwareId !== undefined &&
        compra.itens.some(
          (compraItem) =>
            compraItem.hardwareId === item.hardwareId && compraItem.compravel,
        ),
      representacao3D: item.modelo3dUrl
        ? { tipo: 'MODELO_URL' as const, url: item.modelo3dUrl }
        : {
            tipo: 'PLACEHOLDER_PROCEDURAL' as const,
            url: null,
            aviso:
              'Sem modelo 3D verificado. O frontend pode usar um placeholder até existir modelo próprio/externo.',
          },
    }));

    return {
      tipo: 'MONTAGEM_GUIADA' as const,
      etapa,
      mensagem: this.mensagemEtapaMontagem(etapa),
      pagina,
      filtrosRapidos,
      opcoes: dadosOpcoes.opcoes.map(({ selecao, ...opcao }) => ({
        ...opcao,
        selecao: {
          categoria: selecao.categoria,
          hardwareId: selecao.hardwareId,
          nome: selecao.nome,
          origem: selecao.origem,
          quantidade: 1,
        },
      })),
      temMais: dadosOpcoes.temMais,
      totalOpcoesCompativeisConhecidas: dadosOpcoes.totalCompativeisConhecidos,
      componentes: componentesResposta,
      compatibilidade,
      compra,
      acoes: [
        ...(dadosOpcoes.temMais ? ['VER_MAIS'] : []),
        ...(filtrosRapidos.length > 0 ? ['FILTRAR'] : []),
        ...(etapa !== EtapaMontagemGuiadaIa.RESUMO
          ? ['ESCOLHER_MANUALMENTE', 'ADICIONAR_FORA_CATALOGO', 'IA_DECIDIR']
          : ['SALVAR_BUILD', 'ABRIR_3D']),
        ...(etapa !== EtapaMontagemGuiadaIa.PROCESSADOR ? ['VOLTAR'] : []),
        ...([
          EtapaMontagemGuiadaIa.PLACA_VIDEO,
          EtapaMontagemGuiadaIa.COOLER,
          EtapaMontagemGuiadaIa.VENTOINHA,
        ].includes(etapa)
          ? ['PULAR']
          : []),
      ],
      buildComunidade: {
        podeSalvar: componentes.length > 0,
        componentes: componentes.map((item) => ({
          ...(item.hardwareId !== undefined && { hardwareId: item.hardwareId }),
          categoria: item.categoria,
          nome: item.nome,
          marca: item.marca,
          modelo: item.modelo,
          imagemUrl: item.imagemUrl,
          quantidade: item.quantidade ?? 1,
          especificacoes: item.especificacoes,
          fonteDadosUrl: item.fonteDadosUrl,
          modelo3dUrl: item.modelo3dUrl,
        })),
      },
      observacao:
        'Peças sem hardwareId podem compor e ser salvas na build, mas não possuem preço/oferta/compra até serem cadastradas no catálogo.',
    };
  }

  async montarPc(dados: MontarPcIaDto): Promise<{
    resposta: string;
    componentes?: Array<{ categoria: string; hardwareId: number }>;
    valorTotal?: number;
    consumoWatts?: number;
    acoes?: string[];
    fluxoGuiado?: Awaited<ReturnType<IaService['montagemGuiada']>>;
  }> {
    const catalogo = await this.carregarCatalogoCurto();

    if (catalogo.length === 0) {
      return {
        resposta:
          'O catálogo ainda não possui peças publicadas. A montagem pode continuar pelo fluxo guiado com peças externas; elas ficarão sem preço/oferta até existirem no catálogo.',
        acoes: ['MONTAGEM_GUIADA'],
        fluxoGuiado: await this.montagemGuiada({
          acao: AcaoMontagemGuiadaIa.INICIAR,
          componentes: [],
          orcamento: dados.orcamento,
          uso: dados.uso,
        }),
      };
    }

    const catalogoFormatado = this.formatarCatalogoParaPrompt(catalogo);

    const instrucao = `
O usuário quer montar um PC com os seguintes requisitos:
- Orçamento: R$ ${dados.orcamento.toFixed(2)}
- Uso principal: ${dados.uso ?? 'geral'}
- Resolução: ${dados.resolucao ?? 'não informada'}
- Preferência de marca/fabricante: ${dados.preferencia ?? 'sem preferência'}

CATÁLOGO DISPONÍVEL (use apenas IDs desta lista):
${catalogoFormatado}

INSTRUÇÕES:
1. Escolha componentes do catálogo que formem uma build compatível dentro do orçamento.
2. Priorize: processador, placa-mãe, memória RAM, armazenamento, fonte e gabinete.
3. Inclua placa de vídeo se o orçamento permitir e o uso justificar.
4. Não ultrapasse o orçamento.
5. Ao final, retorne um JSON no seguinte formato (dentro de bloco \`\`\`json):

\`\`\`json
{
  "tipo": "BUILD_RECOMENDADA",
  "componentes": [
    {"categoria": "PROCESSADOR", "hardwareId": 0}
  ],
  "valorTotal": 0.00,
  "consumoEstimadoWatts": 0,
  "acoes": ["ABRIR_3D", "VER_OFERTAS"]
}
\`\`\`

Antes do JSON, explique a build em linguagem simples para o usuário.
`;

    const respostaTexto = await this.gerarRespostaChat(
      PROMPT_SISTEMA_PUBLICO,
      [],
      instrucao,
    );

    // Extrair JSON estruturado da resposta se existir
    const jsonMatch = respostaTexto.match(/```json\s*([\s\S]*?)```/);
    let dadosEstruturados: {
      componentes?: Array<{ categoria: string; hardwareId: number }>;
      valorTotal?: number;
      consumoEstimadoWatts?: number;
      acoes?: string[];
    } = {};

    if (jsonMatch?.[1]) {
      try {
        const valorParseado: unknown = JSON.parse(jsonMatch[1].trim());

        if (this.ehRegistro(valorParseado)) {
          const componentes = Array.isArray(valorParseado.componentes)
            ? valorParseado.componentes.flatMap((item) => {
                if (!this.ehRegistro(item)) {
                  return [];
                }

                const categoria = item.categoria;
                const hardwareId = item.hardwareId;

                if (
                  typeof categoria !== 'string' ||
                  typeof hardwareId !== 'number'
                ) {
                  return [];
                }

                return [{ categoria, hardwareId }];
              })
            : undefined;

          dadosEstruturados = {
            componentes,
            valorTotal:
              typeof valorParseado.valorTotal === 'number'
                ? valorParseado.valorTotal
                : undefined,
            consumoEstimadoWatts:
              typeof valorParseado.consumoEstimadoWatts === 'number'
                ? valorParseado.consumoEstimadoWatts
                : undefined,
            acoes: Array.isArray(valorParseado.acoes)
              ? valorParseado.acoes.filter(
                  (acao): acao is string => typeof acao === 'string',
                )
              : undefined,
          };
        }
      } catch {
        this.logger.warn('Não foi possível parsear JSON da resposta da IA.');
      }
    }

    const respostaSemJson = respostaTexto
      .replace(/```json[\s\S]*?```/g, '')
      .trim();

    // Nunca confia cegamente nos IDs/categorias retornados pelo modelo.
    // Mantém apenas componentes que realmente existem no catálogo publicado.
    const catalogoPorId = new Map(
      catalogo.map((hardware) => [hardware.id, hardware]),
    );
    const componentesValidos = (dadosEstruturados.componentes ?? []).flatMap(
      (componente) => {
        const hardware = catalogoPorId.get(componente.hardwareId);
        if (!hardware || hardware.categoria !== componente.categoria) {
          return [];
        }

        return [
          {
            categoria: hardware.categoria,
            hardwareId: hardware.id,
          },
        ];
      },
    );

    // O preço final vem das ofertas reais carregadas do banco, não do valor
    // calculado pela IA. IDs repetidos continuam contando como peças físicas.
    let precoCompleto = componentesValidos.length > 0;
    const valorTotalReal = componentesValidos.reduce((total, componente) => {
      const hardware = catalogoPorId.get(componente.hardwareId);
      const melhorOferta = hardware?.ofertas[0];

      if (!melhorOferta) {
        precoCompleto = false;
        return total;
      }

      return total + Number(melhorOferta.preco);
    }, 0);

    let consumoWatts: number | undefined;
    const observacoesValidacao: string[] = [];

    const componentesDaCategoria = (categoria: CategoriaHardware) =>
      componentesValidos.filter(
        (componente) => componente.categoria === categoria,
      );
    const buscarPrimeiro = (categoria: CategoriaHardware) =>
      componentesDaCategoria(categoria)[0]?.hardwareId;

    for (const categoriaUnitaria of [
      CategoriaHardware.PROCESSADOR,
      CategoriaHardware.PLACA_MAE,
      CategoriaHardware.FONTE,
      CategoriaHardware.GABINETE,
    ]) {
      const quantidade = componentesDaCategoria(categoriaUnitaria).length;
      if (quantidade > 1) {
        observacoesValidacao.push(
          `A IA selecionou ${quantidade} itens da categoria ${categoriaUnitaria}, mas a montagem comum deve possuir uma única unidade.`,
        );
      }
    }

    const processadorId = buscarPrimeiro(CategoriaHardware.PROCESSADOR);
    const placaMaeId = buscarPrimeiro(CategoriaHardware.PLACA_MAE);
    const gabineteId = buscarPrimeiro(CategoriaHardware.GABINETE);
    const fonteId = buscarPrimeiro(CategoriaHardware.FONTE);
    const memoriasSelecionadas = componentesDaCategoria(
      CategoriaHardware.MEMORIA_RAM,
    );

    if (
      processadorId !== undefined &&
      placaMaeId !== undefined &&
      memoriasSelecionadas.length > 0 &&
      gabineteId !== undefined &&
      fonteId !== undefined
    ) {
      try {
        const quantidadePorMemoria = new Map<number, number>();
        for (const memoriaSelecionada of memoriasSelecionadas) {
          const hardware = catalogoPorId.get(memoriaSelecionada.hardwareId);

          const quantidadeModulosRaw: unknown =
            hardware?.especificacaoMemoriaRam?.quantidadeModulos;
          const modulosPorProduto =
            typeof quantidadeModulosRaw === 'number' &&
            Number.isFinite(quantidadeModulosRaw)
              ? quantidadeModulosRaw
              : 1;
          quantidadePorMemoria.set(
            memoriaSelecionada.hardwareId,
            (quantidadePorMemoria.get(memoriaSelecionada.hardwareId) ?? 0) +
              modulosPorProduto,
          );
        }

        const quantidadeModulosRamTotal = [
          ...quantidadePorMemoria.values(),
        ].reduce((total, quantidade) => total + quantidade, 0);
        const verificacoes: Awaited<
          ReturnType<HardwaresService['verificarCompatibilidadeMontagem']>
        >[] = [];

        for (const [
          memoriaRamId,
          quantidadeModulosRam,
        ] of quantidadePorMemoria) {
          verificacoes.push(
            await this.hardwaresService.verificarCompatibilidadeMontagem({
              placaMaeId,
              processadorId,
              memoriaRamId,
              quantidadeModulosRam,
              quantidadeModulosRamTotal,
              gabineteId,
              fonteId,
              placaVideoId: buscarPrimeiro(CategoriaHardware.PLACA_VIDEO),
              coolerId: buscarPrimeiro(CategoriaHardware.COOLER),
              armazenamentoIds: componentesDaCategoria(
                CategoriaHardware.ARMAZENAMENTO,
              ).map((componente) => componente.hardwareId),
            }),
          );
        }

        consumoWatts = verificacoes[0]?.consumoEnergia.consumoEstimadoWatts;

        if (verificacoes.some((verificacao) => !verificacao.compativel)) {
          observacoesValidacao.push(
            'A seleção sugerida pela IA não passou em todas as verificações de compatibilidade do backend.',
          );
        } else if (
          verificacoes.some(
            (verificacao) => (verificacao.alertas?.length ?? 0) > 0,
          )
        ) {
          observacoesValidacao.push(
            'A seleção passou na compatibilidade, mas possui alertas técnicos que devem ser revisados.',
          );
        }
      } catch {
        observacoesValidacao.push(
          'Não foi possível concluir a validação técnica automática desta sugestão.',
        );
      }
    } else if (componentesValidos.length > 0) {
      observacoesValidacao.push(
        'A sugestão não contém todas as categorias essenciais para uma validação técnica completa.',
      );
    }

    if (!precoCompleto && componentesValidos.length > 0) {
      observacoesValidacao.push(
        'Um ou mais componentes selecionados não possuem oferta ativa; o preço total está incompleto.',
      );
    }

    if (precoCompleto && valorTotalReal > dados.orcamento) {
      observacoesValidacao.push(
        `O preço real das ofertas cadastradas (R$ ${valorTotalReal.toFixed(2)}) ultrapassa o orçamento informado.`,
      );
    }

    const respostaValidada = [respostaSemJson, ...observacoesValidacao]
      .filter((parte) => parte.length > 0)
      .join('\n\n');

    return {
      resposta: respostaValidada,
      componentes: componentesValidos,
      valorTotal: precoCompleto ? Number(valorTotalReal.toFixed(2)) : undefined,
      consumoWatts,
      acoes: dadosEstruturados.acoes ?? ['ABRIR_3D', 'VER_OFERTAS'],
    };
  }

  async recomendarLoja(dados: RecomendarLojaIaDto): Promise<{
    resposta: string;
    produtos: Array<{
      id: number;
      nome: string;
      slug: string;
      categoria: { nome: string; slug: string; grupo: string };
      melhorOferta: {
        id: number;
        preco: unknown;
        urlOriginal: string;
        urlAfiliada: string | null;
        parceiro: { id: number; nome: string; slug: string };
      } | null;
    }>;
  }> {
    const agora = new Date();
    const limite = dados.limite ?? 5;

    const produtos = await this.prisma.produto.findMany({
      where: {
        ativo: true,
        publicado: true,
        categoria: {
          ativo: true,
          ...(dados.categoria && { slug: dados.categoria }),
        },
        ofertas: {
          some: {
            status: StatusOferta.ATIVA,
            parceiro: { ativo: true },
            OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
            ...(dados.orcamento !== undefined && {
              preco: { lte: dados.orcamento },
            }),
          },
        },
      },
      take: 80,
      orderBy: { atualizadoEm: 'desc' },
      select: {
        id: true,
        nome: true,
        slug: true,
        marca: true,
        modelo: true,
        descricao: true,
        categoria: {
          select: { nome: true, slug: true, grupo: true },
        },
        especificacaoMonitor: true,
        especificacaoMouse: true,
        especificacaoTeclado: true,
        especificacaoHeadset: true,
        notebook: { include: { especificacao: true } },
        ofertas: {
          where: {
            status: StatusOferta.ATIVA,
            parceiro: { ativo: true },
            OR: [{ validoAte: null }, { validoAte: { gte: agora } }],
            ...(dados.orcamento !== undefined && {
              preco: { lte: dados.orcamento },
            }),
          },
          orderBy: { preco: 'asc' },
          take: 1,
          select: {
            id: true,
            preco: true,
            urlOriginal: true,
            urlAfiliada: true,
            parceiro: { select: { id: true, nome: true, slug: true } },
          },
        },
      },
    });

    if (produtos.length === 0) {
      return {
        resposta:
          'Não encontrei produtos publicados com oferta ativa que atendam aos filtros informados.',
        produtos: [],
      };
    }

    const catalogoPrompt = produtos
      .map((produto) => {
        const especificacoes =
          produto.especificacaoMonitor ??
          produto.especificacaoMouse ??
          produto.especificacaoTeclado ??
          produto.especificacaoHeadset ??
          produto.notebook?.especificacao ??
          {};
        const oferta = produto.ofertas[0];
        return `- [ID:${produto.id}] ${produto.nome} | Categoria: ${produto.categoria.nome} | Marca: ${produto.marca ?? '?'} | Preço real: R$ ${oferta ? Number(oferta.preco).toFixed(2) : '?'} | Specs: ${JSON.stringify(especificacoes)}`;
      })
      .join('\n');

    const instrucao = `
O usuário está procurando produtos na Loja do CriaByte.
Pedido: ${dados.mensagem}
${dados.orcamento !== undefined ? `Orçamento máximo informado: R$ ${dados.orcamento.toFixed(2)}` : ''}

CATÁLOGO REAL DISPONÍVEL:
${catalogoPrompt}

REGRAS OBRIGATÓRIAS:
- Recomende somente IDs presentes no catálogo acima.
- Não invente produtos, preços, estoque, especificações nem URLs.
- O preço apresentado ao usuário vem do banco de dados.
- Não inclua links na sua resposta; o backend anexará as ofertas reais.
- Escolha no máximo ${limite} produtos.
- Explique de forma curta por que cada opção combina com o pedido.

Ao final retorne também:
\`\`\`json
{"produtoIds":[1,2]}
\`\`\`
`;

    const respostaIa = await this.gerarRespostaChat(
      PROMPT_SISTEMA_PUBLICO,
      [],
      instrucao,
    );

    const jsonMatch = respostaIa.match(/```json\s*([\s\S]*?)```/);
    let idsEscolhidos: number[] = [];
    if (jsonMatch?.[1]) {
      try {
        const parsed: unknown = JSON.parse(jsonMatch[1].trim());
        if (this.ehRegistro(parsed) && Array.isArray(parsed.produtoIds)) {
          idsEscolhidos = parsed.produtoIds.filter(
            (valor): valor is number =>
              typeof valor === 'number' && Number.isInteger(valor),
          );
        }
      } catch {
        this.logger.warn(
          'Não foi possível parsear a seleção da Loja feita pela IA.',
        );
      }
    }

    const mapa = new Map(produtos.map((produto) => [produto.id, produto]));
    const idsValidos = [...new Set(idsEscolhidos)]
      .filter((id) => mapa.has(id))
      .slice(0, limite);
    const fallbackIds = produtos.slice(0, limite).map((produto) => produto.id);
    const idsFinais = idsValidos.length > 0 ? idsValidos : fallbackIds;

    return {
      resposta: respostaIa.replace(/```json[\s\S]*?```/g, '').trim(),
      produtos: idsFinais.flatMap((id) => {
        const produto = mapa.get(id);
        if (!produto) return [];
        return [
          {
            id: produto.id,
            nome: produto.nome,
            slug: produto.slug,
            categoria: produto.categoria,
            melhorOferta: produto.ofertas[0] ?? null,
          },
        ];
      }),
    };
  }

  async chatAdmin(dados: ChatAdminIaDto): Promise<{ resposta: string }> {
    const contextoExtra = dados.contexto
      ? `CONTEXTO DA PÁGINA ADMIN:\n${JSON.stringify(dados.contexto, null, 2)}`
      : '';

    const resposta = await this.gerarRespostaChat(
      PROMPT_SISTEMA_ADMIN,
      dados.historico ?? [],
      dados.mensagem,
      contextoExtra,
    );

    return { resposta };
  }

  // ─── Endpoints administrativos ────────────────────────────────────────────

  async importarLinkAdmin(url: string) {
    const coleta = await this.hardwaresService.importarProdutoPorUrl(url);

    const conteudoParaIa = JSON.stringify(
      {
        url,
        jsonLd: coleta.jsonLd,
        meta: coleta.meta,
        textoExtraido: coleta.textoExtraido,
      },
      null,
      2,
    ).slice(0, 50000);

    let normalizacao: Awaited<
      ReturnType<IaService['normalizarProduto']>
    > | null = null;
    let iaDisponivel = this.iaProvider.estaDisponivel();
    let avisoIa: string | null = null;

    if (iaDisponivel) {
      try {
        normalizacao = await this.normalizarProduto({
          conteudoBruto: conteudoParaIa,
          urlOrigem: url,
        });
      } catch (erro) {
        iaDisponivel = false;
        avisoIa =
          'A página foi coletada, mas a IA não conseguiu normalizar os dados. O ADMIN ainda pode revisar o conteúdo extraído manualmente.';
        this.logger.warn(
          `Falha ao normalizar importação por link: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`,
        );
      }
    } else {
      avisoIa =
        'GEMINI_API_KEY não está disponível. A coleta foi concluída sem normalização por IA.';
    }

    const categoria = normalizacao?.camposNormalizados['categoria'];
    const categoriaTexto =
      typeof categoria === 'string' ? categoria.toUpperCase() : null;
    const categoriasHardware = new Set<string>(
      Object.values(CategoriaHardware),
    );

    return {
      status: 'AGUARDANDO_CONFIRMACAO' as const,
      urlOrigem: url,
      coleta: {
        meta: coleta.meta,
        jsonLd: coleta.jsonLd,
        textoExtraido: coleta.textoExtraido,
      },
      normalizacao,
      iaDisponivel,
      avisoIa,
      destinoSugerido:
        categoriaTexto && categoriasHardware.has(categoriaTexto)
          ? 'HARDWARE'
          : 'PRODUTO',
      confirmacaoSugerida:
        categoriaTexto && categoriasHardware.has(categoriaTexto)
          ? { metodo: 'POST', rota: '/api/hardwares' }
          : { metodo: 'POST', rota: '/api/admin/produtos' },
      confirmacaoObrigatoria: true,
      nenhumRegistroCriado: true,
      proximosPassos: [
        'Revisar nome, marca, modelo, categoria e especificações.',
        'Corrigir campos marcados como ausentes ou interpretados.',
        'Confirmar o cadastro usando a rota administrativa de Hardware/Produto correspondente.',
        'Cadastrar Oferta separadamente quando a URL representar uma loja com preço real.',
      ],
      aviso:
        'A importação por link nunca publica nem cadastra automaticamente. Os dados precisam ser revisados pelo ADMIN antes do cadastro definitivo.',
    };
  }

  async analisarProduto(
    dados: AnalisarProdutoIaDto,
  ): Promise<{ analise: string }> {
    const produto = await this.carregarProdutoParaIa(dados);

    const instrucao = `
Analise o seguinte produto cadastrado no sistema e forneça um relatório completo:

${JSON.stringify(produto, null, 2)}

Verifique e informe:
1. Campos importantes que estão ausentes ou vazios.
2. Possíveis inconsistências nas especificações.
3. Se a categoria comercial e o tipo do produto estão coerentes.
4. Se as especificações técnicas parecem coerentes para a categoria.
5. Se o produto está pronto para publicação.

Não invente dados ausentes. Apresente o resultado em formato claro com ✓ (ok), ⚠ (atenção) e ✗ (problema).
`;

    const analise = await this.gerarRespostaChat(
      PROMPT_SISTEMA_ADMIN,
      [],
      instrucao,
    );

    return { analise };
  }

  async normalizarProduto(dados: NormalizarProdutoIaDto): Promise<{
    camposNormalizados: Record<string, unknown>;
    alertas: string[];
    ausentes: string[];
    textoExplicativo: string;
  }> {
    const instrucao = `
Analise o seguinte conteúdo bruto extraído de uma página de produto${dados.urlOrigem ? ` (origem: ${dados.urlOrigem})` : ''}:

${dados.conteudoBruto}

Extraia e normalize os campos para o sistema CriaByte.
Retorne OBRIGATORIAMENTE um JSON no seguinte formato (dentro de bloco \`\`\`json):

\`\`\`json
{
  "categoria": "",
  "nome": "",
  "marca": "",
  "modelo": "",
  "mpn": "",
  "preco": null,
  "specs": {},
  "alertas": [],
  "ausentes": []
}
\`\`\`

Onde:
- "categoria" pode representar componente, notebook, monitor, mouse, teclado, headset ou outra categoria da Loja identificada no conteúdo.
- Para componentes internos, prefira: PROCESSADOR, PLACA_MAE, MEMORIA_RAM, PLACA_VIDEO, FONTE, GABINETE, ARMAZENAMENTO, COOLER ou VENTOINHA.
- Para a Loja, também podem aparecer MONITOR, MOUSE, TECLADO, HEADSET, NOTEBOOK e outras categorias claramente presentes na fonte.
- "specs" contém SOMENTE especificações encontradas na fonte. Não preencha por conhecimento geral.
- Use, quando aplicável, os mesmos nomes técnicos do backend:
  PROCESSADOR: socket, familia, linha, geracao, nucleos, threads, frequenciaBaseMhz, frequenciaTurboMhz, tdpWatts, possuiVideoIntegrado, modeloVideoIntegrado, tiposMemoriaSuportados.
  PLACA_MAE: socket, chipset, formato, tiposMemoriaSuportados, formatosMemoriaSuportados, frequenciasMemoriaJedecMhz, frequenciasMemoriaOverclockMhz, slotsMemoria, capacidadeMaximaMemoriaGb, saidasVideo, portasSata, slotsM2.
  MEMORIA_RAM: tipo, formato, capacidadePorModuloGb, quantidadeModulos, frequenciaMhz, latenciaCl, tensaoVolts, ecc, registrada, alturaMm.
  PLACA_VIDEO: gpu, memoriaVideoGb, comprimentoMm, alturaMm, espessuraMm, slotsOcupados, consumoWatts, potenciaFonteRecomendadaWatts, conectoresPcie6Pinos, conectoresPcie8Pinos, conectores12vhpwr, conectores12v2x6.
  FONTE: formato, potenciaWatts, certificacao, modularidade, comprimentoMm, conectoresAtx24Pinos, conectoresEpsCpu, conectoresPcie6Pinos, conectoresPcie8Pinos, conectores12vhpwr, conectores12v2x6, conectoresSata.
  GABINETE: tamanho, alturaMm, larguraMm, profundidadeMm, formatosPlacaMaeSuportados, formatosFonteSuportados, comprimentoMaximoGpuMm, slotsMaximosGpu, alturaMaximaCoolerCpuMm, baias25, baias35.
  COOLER: tipo, socketsSuportados, capacidadeTermicaWatts, alturaMm, tamanhoRadiadorMm, quantidadeVentoinhas, tamanhoVentoinhaMm.
  ARMAZENAMENTO: tipo, formato, interface, capacidadeGb, tamanhoM2Mm, chaveM2, geracaoPcie, pistasPcie, leituraSequencialMbps, escritaSequencialMbps.
  VENTOINHA: tamanhoMm, espessuraMm, rpmMinima, rpmMaxima, fluxoArCfm, pressaoEstaticaMmH2o, ruidoDb, conector, pwm, rgb, argb.
- Inclua "evidencias" como objeto opcional mapeando campos importantes para um trecho curto da fonte que sustenta o valor.
- Valores ausentes devem permanecer null ou ser listados em "ausentes".
- "alertas" são inconsistências ou interpretações que exigem revisão.
- "ausentes" são campos importantes que não foram encontrados.

Antes do JSON, explique brevemente o que foi encontrado.
`;

    const respostaTexto = await this.gerarRespostaChat(
      PROMPT_SISTEMA_ADMIN,
      [],
      instrucao,
    );

    const jsonMatch = respostaTexto.match(/```json\s*([\s\S]*?)```/);
    let dadosExtraidos: {
      specs?: Record<string, unknown>;
      alertas?: string[];
      ausentes?: string[];
      [key: string]: unknown;
    } = {};

    if (jsonMatch?.[1]) {
      try {
        const valorParseado: unknown = JSON.parse(jsonMatch[1].trim());

        if (this.ehRegistro(valorParseado)) {
          dadosExtraidos = valorParseado;
        }
      } catch {
        this.logger.warn('Não foi possível parsear JSON da normalização.');
      }
    }

    const {
      alertas = [],
      ausentes = [],
      specs = {},
      ...camposRaiz
    } = dadosExtraidos;
    const camposNormalizados = { ...camposRaiz, ...specs };

    const textoExplicativo = respostaTexto
      .replace(/```json[\s\S]*?```/g, '')
      .trim();

    return {
      camposNormalizados,
      alertas,
      ausentes,
      textoExplicativo,
    };
  }

  async gerarDescricao(
    dados: GerarDescricaoIaDto,
  ): Promise<{ descricao: string }> {
    const produto = await this.carregarProdutoParaIa(dados);

    const instrucao = `
Gere uma descrição concisa e técnica em português para o seguinte produto:

${JSON.stringify(produto, null, 2)}

REGRAS:
- Máximo de 3 frases.
- Mencione somente características presentes nos dados.
- Linguagem clara, útil para uma ficha de produto.
- Não invente especificações, preço, estoque ou compatibilidade.
- Não use superlativos como "melhor", "incrível" ou "revolucionário".
`;

    const descricao = await this.gerarRespostaChat(
      PROMPT_SISTEMA_ADMIN,
      [],
      instrucao,
    );

    return { descricao: descricao.trim() };
  }
}
