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

  // ─── Endpoints públicos ───────────────────────────────────────────────────

  async chat(dados: ChatIaDto): Promise<{ resposta: string }> {
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

  async montarPc(dados: MontarPcIaDto): Promise<{
    resposta: string;
    componentes?: Array<{ categoria: string; hardwareId: number }>;
    valorTotal?: number;
    consumoWatts?: number;
    acoes?: string[];
  }> {
    const catalogo = await this.carregarCatalogoCurto();

    if (catalogo.length === 0) {
      return {
        resposta:
          'O catálogo de produtos não possui itens publicados no momento. Não é possível montar uma configuração.',
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

Extraia e normalize os campos para o sistema PC Builder.
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
- "categoria" pode representar componente, notebook, monitor, mouse, teclado, headset ou outra categoria da Loja identificada no conteúdo
- Para componentes internos, prefira: PROCESSADOR, PLACA_MAE, MEMORIA_RAM, PLACA_VIDEO, FONTE, GABINETE, ARMAZENAMENTO, COOLER ou VENTOINHA
- Para a Loja, também podem aparecer MONITOR, MOUSE, TECLADO, HEADSET, NOTEBOOK e outras categorias claramente presentes na fonte
- "specs" contém somente especificações encontradas na fonte; valores ausentes devem permanecer null ou ser listados em "ausentes"
- "alertas" são inconsistências encontradas
- "ausentes" são campos importantes que não foram encontrados

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
