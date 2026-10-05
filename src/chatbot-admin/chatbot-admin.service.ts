import { assertCatalogIdentityAvailable } from '../common/catalog-identity';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import {
  CategoriaHardware,
  GrupoCategoriaProduto,
  StatusOferta,
  TipoProduto,
} from '../generated/prisma/enums';
import { validarUrlPublica } from '../common/security/external-http-security';
import { CriarHardwareDto } from '../hardwares/dtos/criar-hardware.dto';
import { HardwaresService } from '../hardwares/hardwares.service';
import {
  ehCategoriaImportacaoIa,
  type CategoriaImportacaoIa,
} from '../ia/dtos/categoria-importacao-ia';
import {
  ProdutoIaPythonService,
  type ResultadoProdutoIaPython,
} from '../ia/produto-ia-python.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AcaoChatbotCadastro,
  AnalisarCadastroChatbotDto,
} from './dtos/analisar-cadastro-chatbot.dto';
import {
  AjustesCadastroChatbotDto,
  ConfirmarCadastroChatbotDto,
} from './dtos/confirmar-cadastro-chatbot.dto';
import { ehHostShopee, hostCompativelComParceiro } from './marketplace-domains';

const CATEGORIAS_HARDWARE_TECNICO = new Set<CategoriaHardware>([
  CategoriaHardware.PROCESSADOR,
  CategoriaHardware.PLACA_MAE,
  CategoriaHardware.MEMORIA_RAM,
  CategoriaHardware.PLACA_VIDEO,
  CategoriaHardware.ARMAZENAMENTO,
  CategoriaHardware.FONTE,
  CategoriaHardware.GABINETE,
  CategoriaHardware.COOLER,
  CategoriaHardware.VENTOINHA,
]);

const CATEGORIA_PRODUTO_HARDWARE: Record<
  string,
  { nome: string; slug: string }
> = {
  PROCESSADOR: { nome: 'Processadores', slug: 'processadores' },
  PLACA_MAE: { nome: 'Placas-mãe', slug: 'placas-mae' },
  MEMORIA_RAM: { nome: 'Memórias RAM', slug: 'memorias-ram' },
  PLACA_VIDEO: { nome: 'Placas de vídeo', slug: 'placas-video' },
  ARMAZENAMENTO: { nome: 'Armazenamento', slug: 'armazenamento' },
  FONTE: { nome: 'Fontes', slug: 'fontes' },
  GABINETE: { nome: 'Gabinetes', slug: 'gabinetes' },
  COOLER: { nome: 'Coolers', slug: 'coolers' },
  VENTOINHA: { nome: 'Ventoinhas', slug: 'ventoinhas' },
};

const SLUGS_PRODUTO: Partial<Record<CategoriaImportacaoIa, string>> = {
  NOTEBOOK: 'notebooks',
  PC_MONTADO: 'pcs-montados',
  CELULAR: 'celulares',
  MONITOR: 'monitores',
  MOUSE: 'mouses',
  TECLADO: 'teclados',
  HEADSET: 'headsets',
  FONE: 'fones',
  MICROFONE: 'microfones',
  WEBCAM: 'webcams',
  CONTROLE: 'controles',
  MOUSEPAD: 'mousepads',
  CADEIRA: 'cadeiras',
  MESA: 'mesas',
  SUPORTE_MONITOR: 'suportes-monitor',
  ILUMINACAO: 'iluminacao',
  ORGANIZADOR_CABOS: 'organizadores-cabos',
  ACESSORIO: 'acessorios',
  PROJETOR: 'projetores',
  CALCULADORA: 'calculadoras',
  TELEFONE: 'telefones',
  IMPRESSORA: 'impressoras',
  SCANNER: 'scanners',
  CAIXA_DE_SOM: 'caixas-de-som',
  ROTEADOR: 'roteadores',
  REPETIDOR_WIFI: 'repetidores-wifi',
  SWITCH_REDE: 'switches-de-rede',
  ADAPTADOR_WIFI_BLUETOOTH: 'adaptadores-wifi-bluetooth',
  NOBREAK: 'nobreaks',
  ESTABILIZADOR: 'estabilizadores',
  FILTRO_DE_LINHA: 'filtros-de-linha',
  TABLET: 'tablets',
  MICROCONTROLADOR: 'microcontroladores',
  KIT_ARDUINO_ROBOTICA: 'kits-arduino-robotica',
  MINI_COMPUTADOR: 'mini-computadores',
  RELOGIO_INTELIGENTE: 'relogios-inteligentes',
  JOYSTICK: 'joysticks',
  CONTROLE_VIDEO_GAME: 'controles-videogame',
  VOLANTE: 'volantes',
  VIDEOGAME: 'videogames-consoles',
  JOGO: 'jogos',
  SMART_TV: 'smart-tvs',
  CAMERA: 'cameras',
  CARREGADOR: 'carregadores',
  POWER_BANK: 'power-banks',
  CABO_ADAPTADOR: 'cabos-adaptadores',
  HUB_USB: 'hubs-usb',
  DOCK_STATION: 'dock-stations',
  PEN_DRIVE: 'pen-drives',
  CARTAO_MEMORIA: 'cartoes-de-memoria',
  LEITOR_CARTAO: 'leitores-de-cartao',
  ARMAZENAMENTO_EXTERNO: 'armazenamento-externo',
  IMPRESSORA_3D: 'impressoras-3d',
  ACESSORIO_IMPRESSAO_3D: 'acessorios-impressao-3d',
  ASPIRADOR_PO: 'aspiradores-de-po',
  ROBO_ASPIRADOR: 'robos-aspiradores',
  SMART_SPEAKER: 'smart-speakers',
  CAMERA_SEGURANCA: 'cameras-de-seguranca',
  LAMPADA_INTELIGENTE: 'lampadas-inteligentes',
  TOMADA_INTELIGENTE: 'tomadas-inteligentes',
  FECHADURA_INTELIGENTE: 'fechaduras-inteligentes',
  E_READER: 'e-readers',
  DRONE: 'drones',
  CAMERA_ACAO: 'cameras-de-acao',
  SOUNDBAR: 'soundbars',
  HOME_THEATER: 'home-theaters',
  TV: 'tvs',
  AIR_FRYER: 'air-fryers',
  CAFETEIRA: 'cafeteiras',
  LIQUIDIFICADOR: 'liquidificadores',
  VENTILADOR: 'ventiladores',
  CLIMATIZADOR: 'climatizadores',
};

type CriterioDuplicidade =
  | 'HARDWARE_VINCULADO'
  | 'GTIN'
  | 'MPN_MARCA'
  | 'MARCA_MODELO'
  | 'NOME_MARCA'
  | null;

type SnapshotCadastro = {
  categoria: string | null;
  categoriaSlug: string | null;
  ehHardwareTecnico: boolean;
  hardware: Record<string, unknown>;
  produto: Record<string, unknown>;
  oferta: {
    preco: number | null;
    precoAnterior: number | null;
    disponivel: boolean | null;
    urlOriginal: string;
    urlAfiliada: string | null;
    codigoMarketplace: string | null;
    fontePreco: string | null;
  };
  parceiro: { id: number; nome: string; dominio: string | null } | null;
  servicoProdutoIa: Record<string, unknown> | null;
  erroProdutoIa: string | null;
};

type ReconciliacaoToken = {
  hardwareExistenteId: number | null;
  produtoExistenteId: number | null;
  ofertaExistenteId: number | null;
  criterioHardware: CriterioDuplicidade;
  criterioProduto: CriterioDuplicidade;
  camposPreenchiveisHardware: string[];
  camposPreenchiveisProduto: string[];
  conflitosHardware: Array<{ campo: string; banco: unknown; ia: unknown }>;
  conflitosProduto: Array<{ campo: string; banco: unknown; ia: unknown }>;
  candidatosHardware: Array<{ id: number; nome: string }>;
  candidatosProduto: Array<{ id: number; nome: string }>;
  podeConfirmar: boolean;
  avisos: string[];
};

@Injectable()
export class ChatbotAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly produtoIa: ProdutoIaPythonService,
    private readonly hardwaresService: HardwaresService,
  ) {}

  private ehRegistro(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  }

  private texto(valor: unknown): string | null {
    return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
  }

  private numero(valor: unknown): number | null {
    if (typeof valor === 'number') {
      return Number.isFinite(valor) && valor > 0
        ? Number(valor.toFixed(2))
        : null;
    }
    if (typeof valor !== 'string' || !valor.trim()) return null;
    const texto = valor
      .replace(/R\$/giu, '')
      .replace(/\s/gu, '')
      .replace(/\.(?=\d{3}(?:\D|$))/gu, '')
      .replace(',', '.');
    const numero = Number(texto.replace(/[^0-9.-]/gu, ''));
    return Number.isFinite(numero) && numero > 0
      ? Number(numero.toFixed(2))
      : null;
  }

  private booleano(valor: unknown): boolean | null {
    return typeof valor === 'boolean' ? valor : null;
  }

  private removerNulos(valor: unknown): unknown {
    if (Array.isArray(valor)) {
      return valor
        .map((item) => this.removerNulos(item))
        .filter((item) => item !== null && item !== undefined);
    }
    if (this.ehRegistro(valor)) {
      return Object.fromEntries(
        Object.entries(valor)
          .filter(([, item]) => item !== null && item !== undefined)
          .map(([chave, item]) => [chave, this.removerNulos(item)]),
      );
    }
    return valor;
  }

  private normalizarComparacao(valor: unknown): string {
    if (typeof valor === 'string') {
      return valor
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '')
        .trim()
        .toLowerCase();
    }
    if (typeof valor === 'number' || typeof valor === 'boolean') {
      return String(valor);
    }
    return valor === null || valor === undefined ? '' : JSON.stringify(valor);
  }

  private pareceMemoriaRam(
    url: URL,
    payload: Record<string, unknown>,
  ): boolean {
    const texto = this.normalizarComparacao(
      [
        this.texto(payload.nome),
        this.texto(payload.modelo),
        decodeURIComponent(url.pathname).replace(/[-_]+/gu, ' '),
      ]
        .filter(Boolean)
        .join(' '),
    );

    if (!texto) return false;

    // Não transformar produto completo em RAM apenas porque a ficha cita DDR/GB.
    if (
      /\b(?:notebook|laptop|ultrabook|smartphone|celular|iphone|tablet|pc gamer|computador|desktop|placa mae|motherboard|placa de video|gpu|monitor)\b/u.test(
        texto,
      )
    ) {
      return false;
    }

    if (
      /^(?:memoria(?: ram)?|ram|kit (?:de )?(?:memoria|ram))\b/u.test(texto)
    ) {
      return true;
    }

    const temDdr = /\bddr[345]\b/u.test(texto);
    const temCapacidade = /\b(?:4|8|16|24|32|48|64|96|128)\s*gb\b/u.test(texto);
    const temFrequencia = /\b\d{4,5}\s*mhz\b/u.test(texto);
    const temFormato = /\b(?:so[- ]?dimm|sodimm|udimm|dimm)\b/u.test(texto);

    return temDdr && temCapacidade && (temFrequencia || temFormato);
  }

  private criarSlug(texto: string): string {
    return (
      texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '') || 'produto'
    );
  }

  private async criarSlugProdutoUnico(
    tx: Prisma.TransactionClient,
    texto: string,
  ): Promise<string> {
    const base = this.criarSlug(texto);
    let slug = base;
    let numero = 2;
    while (
      await tx.produto.findUnique({ where: { slug }, select: { id: true } })
    ) {
      slug = `${base}-${numero++}`;
    }
    return slug;
  }

  private categoriaTecnica(valor: string | null): CategoriaHardware | null {
    if (!valor) return null;
    if (
      !Object.values(CategoriaHardware).some((categoria) => categoria === valor)
    ) {
      return null;
    }
    const categoria = valor as CategoriaHardware;
    return CATEGORIAS_HARDWARE_TECNICO.has(categoria) ? categoria : null;
  }

  private categoriaEscolhida(
    resultado: ResultadoProdutoIaPython,
    esperada?: string,
  ): { categoria: CategoriaImportacaoIa | null; aviso: string | null } {
    const detectada = this.texto(resultado.categoriaDetectada);
    const detectadaValida = ehCategoriaImportacaoIa(detectada)
      ? detectada
      : null;
    const esperadaValida = ehCategoriaImportacaoIa(esperada) ? esperada : null;

    if (detectadaValida) {
      return {
        categoria: detectadaValida,
        aviso:
          esperadaValida && esperadaValida !== detectadaValida
            ? `A categoria esperada (${esperadaValida}) diverge da categoria detectada (${detectadaValida}). A categoria detectada foi usada na prévia.`
            : null,
      };
    }

    return { categoria: esperadaValida, aviso: null };
  }

  private payloadIa(
    resultado: ResultadoProdutoIaPython,
  ): Record<string, unknown> {
    if (this.ehRegistro(resultado.cadastroSugerido?.payload)) {
      return resultado.cadastroSugerido?.payload ?? {};
    }
    return this.ehRegistro(resultado.payloadParcialBackend)
      ? resultado.payloadParcialBackend
      : {};
  }

  private async identificarParceiro(url: URL, urlAfiliada?: URL | null) {
    const hosts = [urlAfiliada, url]
      .filter((item): item is URL => Boolean(item))
      .map((item) => item.hostname.toLowerCase().replace(/^www\./u, ''));
    const parceiros = await this.prisma.parceiro.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, slug: true, dominio: true },
    });

    if (hosts.some((host) => ehHostShopee(host))) {
      const parceiroShopee =
        parceiros.find((parceiro) => {
          const slug = parceiro.slug.trim().toLowerCase();
          const nome = parceiro.nome.trim().toLowerCase();
          return slug === 'shopee' || nome === 'shopee';
        }) ??
        parceiros.find((parceiro) =>
          hosts.some((host) =>
            hostCompativelComParceiro(host, parceiro.dominio),
          ),
        );

      if (parceiroShopee) {
        return {
          id: parceiroShopee.id,
          nome: parceiroShopee.nome,
          dominio: parceiroShopee.dominio,
        };
      }
    }

    const parceiro =
      parceiros.find((item) =>
        hosts.some((host) => hostCompativelComParceiro(host, item.dominio)),
      ) ?? null;

    return parceiro
      ? { id: parceiro.id, nome: parceiro.nome, dominio: parceiro.dominio }
      : null;
  }

  private ehMagazineVoceCriabyte(url: URL): boolean {
    const host = url.hostname.toLowerCase().replace(/^www\./u, '');
    return (
      host === 'magazinevoce.com.br' &&
      /^\/magazinecriabyte(?:\/|$)/iu.test(url.pathname)
    );
  }

  private async buscarHardware(payload: Record<string, unknown>): Promise<{
    registro: {
      id: number;
      produtoId: number | null;
      nome: string;
      marca: string;
      modelo: string;
      descricao: string | null;
      mpn: string | null;
      gtin: string | null;
      imagemUrl: string | null;
      categoria: CategoriaHardware;
    } | null;
    criterio: CriterioDuplicidade;
    candidatos: Array<{ id: number; nome: string }>;
  }> {
    const gtin = this.texto(payload.gtin);
    const mpn = this.texto(payload.mpn);
    const marca = this.texto(payload.marca);
    const modelo = this.texto(payload.modelo);
    const nome = this.texto(payload.nome);
    const select = {
      id: true,
      produtoId: true,
      nome: true,
      marca: true,
      modelo: true,
      descricao: true,
      mpn: true,
      gtin: true,
      imagemUrl: true,
      categoria: true,
    } as const;

    if (gtin) {
      const registro = await this.prisma.hardware.findFirst({
        where: { gtin },
        select,
      });
      if (registro) return { registro, criterio: 'GTIN', candidatos: [] };
    }
    if (mpn && marca) {
      const registro = await this.prisma.hardware.findFirst({
        where: { mpn, marca: { equals: marca, mode: 'insensitive' } },
        select,
      });
      if (registro) return { registro, criterio: 'MPN_MARCA', candidatos: [] };
    }
    if (marca && modelo) {
      const registro = await this.prisma.hardware.findFirst({
        where: {
          marca: { equals: marca, mode: 'insensitive' },
          modelo: { equals: modelo, mode: 'insensitive' },
        },
        select,
      });
      if (registro) {
        return { registro, criterio: 'MARCA_MODELO', candidatos: [] };
      }
    }

    if (nome && marca) {
      const candidatos = await this.prisma.hardware.findMany({
        where: {
          nome: { equals: nome, mode: 'insensitive' },
          marca: { equals: marca, mode: 'insensitive' },
        },
        take: 5,
        select: { id: true, nome: true },
      });
      if (candidatos.length === 1) {
        const registro = await this.prisma.hardware.findUnique({
          where: { id: candidatos[0].id },
          select,
        });
        return { registro, criterio: 'NOME_MARCA', candidatos: [] };
      }
      if (candidatos.length > 1) {
        return { registro: null, criterio: null, candidatos };
      }
    }

    return { registro: null, criterio: null, candidatos: [] };
  }

  private async buscarProduto(
    payload: Record<string, unknown>,
    hardwareProdutoId: number | null,
  ): Promise<{
    registro: {
      id: number;
      nome: string;
      marca: string | null;
      modelo: string | null;
      descricao: string | null;
      mpn: string | null;
      gtin: string | null;
      imagemUrl: string | null;
      categoriaId: number;
      tipo: TipoProduto;
      hardware: { id: number; categoria: CategoriaHardware } | null;
    } | null;
    criterio: CriterioDuplicidade;
    candidatos: Array<{ id: number; nome: string }>;
  }> {
    const select = {
      id: true,
      nome: true,
      marca: true,
      modelo: true,
      descricao: true,
      mpn: true,
      gtin: true,
      imagemUrl: true,
      categoriaId: true,
      tipo: true,
      hardware: { select: { id: true, categoria: true } },
    } as const;

    if (hardwareProdutoId) {
      const registro = await this.prisma.produto.findUnique({
        where: { id: hardwareProdutoId },
        select,
      });
      if (registro) {
        return {
          registro,
          criterio: 'HARDWARE_VINCULADO',
          candidatos: [],
        };
      }
    }

    const gtin = this.texto(payload.gtin);
    const mpn = this.texto(payload.mpn);
    const marca = this.texto(payload.marca);
    const modelo = this.texto(payload.modelo);
    const nome = this.texto(payload.nome);

    if (gtin) {
      const registro = await this.prisma.produto.findFirst({
        where: { gtin },
        select,
      });
      if (registro) return { registro, criterio: 'GTIN', candidatos: [] };
    }
    if (mpn && marca) {
      const registro = await this.prisma.produto.findFirst({
        where: { mpn, marca: { equals: marca, mode: 'insensitive' } },
        select,
      });
      if (registro) return { registro, criterio: 'MPN_MARCA', candidatos: [] };
    }
    if (marca && modelo) {
      const registro = await this.prisma.produto.findFirst({
        where: {
          marca: { equals: marca, mode: 'insensitive' },
          modelo: { equals: modelo, mode: 'insensitive' },
        },
        select,
      });
      if (registro) {
        return { registro, criterio: 'MARCA_MODELO', candidatos: [] };
      }
    }

    if (nome) {
      const candidatos = await this.prisma.produto.findMany({
        where: {
          nome: { equals: nome, mode: 'insensitive' },
          ...(marca && { marca: { equals: marca, mode: 'insensitive' } }),
        },
        take: 5,
        select: { id: true, nome: true },
      });
      if (candidatos.length === 1) {
        const registro = await this.prisma.produto.findUnique({
          where: { id: candidatos[0].id },
          select,
        });
        return { registro, criterio: 'NOME_MARCA', candidatos: [] };
      }
      if (candidatos.length > 1) {
        return { registro: null, criterio: null, candidatos };
      }
    }

    return { registro: null, criterio: null, candidatos: [] };
  }

  private compararCampos(
    existente: Record<string, unknown>,
    payload: Record<string, unknown>,
  ) {
    const campos = [
      'nome',
      'marca',
      'modelo',
      'descricao',
      'mpn',
      'gtin',
      'imagemUrl',
    ];
    const preenchiveis: string[] = [];
    const conflitos: Array<{ campo: string; banco: unknown; ia: unknown }> = [];

    for (const campo of campos) {
      const banco = existente[campo];
      const ia = payload[campo];
      const normalBanco = this.normalizarComparacao(banco);
      const normalIa = this.normalizarComparacao(ia);
      if (!normalIa) continue;
      if (!normalBanco) preenchiveis.push(campo);
      else if (normalBanco !== normalIa) conflitos.push({ campo, banco, ia });
    }

    return { preenchiveis, conflitos };
  }

  private objetoComparacao(valor: object): Record<string, unknown> {
    return { ...valor };
  }

  private normalizarClockPlacaVideoIa(
    payload: Record<string, unknown>,
  ): boolean {
    const especificacao = this.ehRegistro(payload.especificacaoPlacaVideo)
      ? payload.especificacaoPlacaVideo
      : null;
    if (!especificacao) return false;

    const base = this.numero(especificacao.clockBaseMhz);
    const boost = this.numero(especificacao.clockBoostMhz);
    if (base === null || boost === null || base <= boost) return false;

    const corrigida = { ...especificacao };
    delete corrigida.clockBoostMhz;
    payload.especificacaoPlacaVideo = corrigida;
    return true;
  }

  private async categoriaProdutoId(
    categoria: CategoriaImportacaoIa | null,
    slugSugerido: string | null,
  ): Promise<number | null> {
    if (!categoria) return null;
    const tecnica = this.categoriaTecnica(categoria);
    const slug = tecnica
      ? CATEGORIA_PRODUTO_HARDWARE[tecnica]?.slug
      : slugSugerido || SLUGS_PRODUTO[categoria];
    if (!slug) return null;
    const categoriaProduto = await this.prisma.categoriaProduto.findUnique({
      where: { slug },
      select: { id: true },
    });
    return categoriaProduto?.id ?? null;
  }

  async analisarCadastro(usuarioId: number, dados: AnalisarCadastroChatbotDto) {
    let urlValidada: URL;
    try {
      urlValidada = (await validarUrlPublica(dados.url)).url;
    } catch (erro) {
      throw new BadRequestException(
        erro instanceof Error ? erro.message : 'URL inválida.',
      );
    }

    let urlAfiliadaValidada: URL | null = null;
    if (dados.urlAfiliada) {
      try {
        urlAfiliadaValidada = (await validarUrlPublica(dados.urlAfiliada)).url;
      } catch (erro) {
        throw new BadRequestException(
          erro instanceof Error ? erro.message : 'URL afiliada inválida.',
        );
      }
    }

    const categoriaEsperada = ehCategoriaImportacaoIa(dados.categoriaEsperada)
      ? dados.categoriaEsperada
      : undefined;
    const opcoesImportacao = {
      enrich: true,
      criabytePlan: true,
      noBrowser: false,
      detalharPagina: true,
      urlAfiliada: urlAfiliadaValidada?.toString(),
    };
    let resultadoIa = await this.produtoIa.importarUrl(
      urlValidada.toString(),
      categoriaEsperada,
      opcoesImportacao,
    );

    let payloadBase = this.payloadIa(resultadoIa);
    let categoriaResultado = this.categoriaEscolhida(
      resultadoIa,
      categoriaEsperada,
    );
    let categoriaRamCorrigida = false;

    if (
      !categoriaEsperada &&
      categoriaResultado.categoria !== CategoriaHardware.MEMORIA_RAM &&
      this.categoriaTecnica(categoriaResultado.categoria) === null &&
      this.pareceMemoriaRam(urlValidada, payloadBase)
    ) {
      resultadoIa = await this.produtoIa.importarUrl(
        urlValidada.toString(),
        CategoriaHardware.MEMORIA_RAM,
        opcoesImportacao,
      );
      payloadBase = this.payloadIa(resultadoIa);
      categoriaResultado = this.categoriaEscolhida(
        resultadoIa,
        CategoriaHardware.MEMORIA_RAM,
      );
      categoriaRamCorrigida = true;
    }
    const categoria = categoriaResultado.categoria;
    const categoriaTecnica = this.categoriaTecnica(categoria);
    const ehHardwareTecnico = categoriaTecnica !== null;
    const payload: Record<string, unknown> = { ...payloadBase };
    const clockGpuConflitanteRemovido =
      categoriaTecnica === CategoriaHardware.PLACA_VIDEO
        ? this.normalizarClockPlacaVideoIa(payload)
        : false;
    if (!ehHardwareTecnico) {
      const especificacoes = this.ehRegistro(
        resultadoIa.especificacoesEncontradas,
      )
        ? resultadoIa.especificacoesEncontradas
        : {};
      const informacoes = Array.isArray(
        resultadoIa.informacoesProdutoEncontradas,
      )
        ? resultadoIa.informacoesProdutoEncontradas.slice(0, 300)
        : [];
      if (Object.keys(especificacoes).length > 0 || informacoes.length > 0) {
        payload.metadados = {
          ...(Object.keys(especificacoes).length > 0 ? { especificacoes } : {}),
          ...(informacoes.length > 0
            ? { atributosColetados: informacoes }
            : {}),
        };
      }
    }
    const ofertaIa = this.ehRegistro(resultadoIa.ofertaColetada)
      ? resultadoIa.ofertaColetada
      : {};
    const parceiro = await this.identificarParceiro(
      urlValidada,
      urlAfiliadaValidada,
    );
    const categoriaSlug =
      this.texto(resultadoIa.categoriaSlugSugerida) ||
      (categoria ? (SLUGS_PRODUTO[categoria] ?? null) : null) ||
      (categoriaTecnica
        ? (CATEGORIA_PRODUTO_HARDWARE[categoriaTecnica]?.slug ?? null)
        : null);
    const categoriaProdutoId = await this.categoriaProdutoId(
      categoria,
      categoriaSlug,
    );

    const hardwareBusca = ehHardwareTecnico
      ? await this.buscarHardware(payload)
      : { registro: null, criterio: null, candidatos: [] };
    const produtoBusca = await this.buscarProduto(
      payload,
      hardwareBusca.registro?.produtoId ?? null,
    );

    const codigoMarketplace = this.texto(ofertaIa.codigoMarketplace);
    const urlOriginal =
      this.texto(ofertaIa.urlOriginal) ?? urlValidada.toString();
    let ofertaExistente: { id: number } | null = null;
    if (produtoBusca.registro && parceiro) {
      ofertaExistente = await this.prisma.oferta.findFirst({
        where: {
          produtoId: produtoBusca.registro.id,
          parceiroId: parceiro.id,
          OR: [
            { urlOriginal },
            ...(codigoMarketplace ? [{ codigoMarketplace }] : []),
          ],
        },
        select: {
          id: true,
          produtoId: true,
          parceiroId: true,
          preco: true,
          precoAnterior: true,
          status: true,
          urlOriginal: true,
          urlAfiliada: true,
          codigoMarketplace: true,
        },
      });
    }

    const hardwareComparacao = hardwareBusca.registro
      ? this.compararCampos(
          this.objetoComparacao(hardwareBusca.registro),
          payload,
        )
      : { preenchiveis: [], conflitos: [] };
    const produtoComparacao = produtoBusca.registro
      ? this.compararCampos(
          this.objetoComparacao(produtoBusca.registro),
          payload,
        )
      : { preenchiveis: [], conflitos: [] };

    const erroProdutoIa = this.texto(resultadoIa.erro);
    const origemColeta = this.ehRegistro(resultadoIa.origemColeta)
      ? this.texto(resultadoIa.origemColeta.fonte)
      : this.texto(resultadoIa.fonte);
    const coletaMagaluBloqueada =
      erroProdutoIa === 'MAGALU_COLETA_BLOQUEADA' ||
      origemColeta === 'MAGALU_BLOQUEADO';

    const avisos: string[] = [];
    if (clockGpuConflitanteRemovido) {
      avisos.push(
        'O clock boost coletado da placa de vídeo contradizia o clock base e foi removido da prévia para revisão.',
      );
    }
    if (categoriaRamCorrigida) {
      avisos.push(
        'O produto foi reconhecido como Memória RAM e será tratado como Hardware técnico, não como Produto genérico.',
      );
    }
    const adicionarAviso = (aviso: string | null | undefined) => {
      if (aviso && !avisos.includes(aviso)) avisos.push(aviso);
    };

    if (coletaMagaluBloqueada) {
      adicionarAviso(
        'A Magalu bloqueou a coleta automática desta página. As rotas alternativas foram tentadas, mas nenhum dado incompleto será cadastrado.',
      );
    } else {
      adicionarAviso(categoriaResultado.aviso);
      if (erroProdutoIa) adicionarAviso(`Produto IA: ${erroProdutoIa}`);
      if (!categoria)
        adicionarAviso('A categoria não pôde ser determinada com segurança.');
    }
    if (
      dados.acao === AcaoChatbotCadastro.CADASTRAR_HARDWARE &&
      !ehHardwareTecnico
    ) {
      avisos.push(
        'A categoria detectada não pertence ao catálogo técnico de Hardware do PC Builder.',
      );
    }
    if (dados.acao === AcaoChatbotCadastro.CADASTRAR_PRODUTO && !parceiro) {
      avisos.push(
        'Parceiro não identificado pelo domínio. Selecione um parceiro antes da confirmação.',
      );
    }
    if (
      !coletaMagaluBloqueada &&
      dados.acao === AcaoChatbotCadastro.CADASTRAR_PRODUTO &&
      !ehHardwareTecnico &&
      !categoriaProdutoId
    ) {
      adicionarAviso(
        'Categoria comercial não encontrada no banco. Selecione a categoria antes da confirmação.',
      );
    }
    if (hardwareBusca.candidatos.length > 1) {
      avisos.push(
        'Há mais de um Hardware candidato. É necessária escolha manual.',
      );
    }
    if (produtoBusca.candidatos.length > 1) {
      avisos.push(
        'Há mais de um Produto candidato. É necessária escolha manual.',
      );
    }
    if (hardwareComparacao.conflitos.length > 0) {
      avisos.push(
        'Há conflitos entre a ficha técnica coletada e o Hardware existente; eles não serão sobrescritos automaticamente.',
      );
    }
    if (produtoComparacao.conflitos.length > 0) {
      avisos.push(
        'Há conflitos entre os dados coletados e o Produto existente; eles não serão sobrescritos automaticamente.',
      );
    }

    const preco = this.numero(ofertaIa.preco);
    const precoAnterior = this.numero(ofertaIa.precoAnterior);
    const urlAfiliada =
      urlAfiliadaValidada?.toString() ??
      this.texto(ofertaIa.urlAfiliada) ??
      (this.ehMagazineVoceCriabyte(urlValidada)
        ? urlValidada.toString()
        : null);
    const bloqueado =
      Boolean(erroProdutoIa) || origemColeta?.includes('BLOQUEADO') === true;
    const possuiRaizHardware = Boolean(
      this.texto(payload.nome) &&
      this.texto(payload.marca) &&
      this.texto(payload.modelo) &&
      categoriaTecnica,
    );

    const podeConfirmarHardware =
      ehHardwareTecnico &&
      hardwareBusca.candidatos.length === 0 &&
      (Boolean(hardwareBusca.registro) || possuiRaizHardware) &&
      !bloqueado;
    const podeConfirmarProduto =
      Boolean(categoria) &&
      produtoBusca.candidatos.length === 0 &&
      hardwareBusca.candidatos.length === 0 &&
      Boolean(produtoBusca.registro || this.texto(payload.nome)) &&
      Boolean(ehHardwareTecnico || categoriaProdutoId) &&
      Boolean(parceiro) &&
      preco !== null &&
      (!ehHardwareTecnico ||
        Boolean(hardwareBusca.registro) ||
        possuiRaizHardware) &&
      !bloqueado;
    const podeConfirmar =
      dados.acao === AcaoChatbotCadastro.CADASTRAR_HARDWARE
        ? podeConfirmarHardware
        : podeConfirmarProduto;

    const snapshot: SnapshotCadastro = {
      categoria,
      categoriaSlug,
      ehHardwareTecnico,
      hardware: payload,
      produto: payload,
      oferta: {
        preco,
        precoAnterior,
        disponivel: this.booleano(ofertaIa.disponivel),
        urlOriginal,
        urlAfiliada,
        codigoMarketplace,
        fontePreco: this.texto(ofertaIa.fontePreco),
      },
      parceiro,
      servicoProdutoIa: this.ehRegistro(resultadoIa.servicoProdutoIa)
        ? resultadoIa.servicoProdutoIa
        : null,
      erroProdutoIa,
    };

    const reconciliacao: ReconciliacaoToken = {
      hardwareExistenteId: hardwareBusca.registro?.id ?? null,
      produtoExistenteId: produtoBusca.registro?.id ?? null,
      ofertaExistenteId: ofertaExistente?.id ?? null,
      criterioHardware: hardwareBusca.criterio,
      criterioProduto: produtoBusca.criterio,
      camposPreenchiveisHardware: hardwareComparacao.preenchiveis,
      camposPreenchiveisProduto: produtoComparacao.preenchiveis,
      conflitosHardware: hardwareComparacao.conflitos,
      conflitosProduto: produtoComparacao.conflitos,
      candidatosHardware: hardwareBusca.candidatos,
      candidatosProduto: produtoBusca.candidatos,
      podeConfirmar,
      avisos,
    };

    const token = randomUUID();
    const expiraEm = new Date(Date.now() + 20 * 60 * 1000);
    await this.prisma.chatbotCadastroToken.create({
      data: {
        token,
        usuarioId,
        acao: dados.acao,
        url: urlValidada.toString(),
        categoriaEsperada: categoriaEsperada ?? null,
        resultadoNormalizado: snapshot as unknown as Prisma.InputJsonValue,
        reconciliacao: reconciliacao as unknown as Prisma.InputJsonValue,
        expiraEm,
      },
    });

    void this.prisma.chatbotCadastroToken.deleteMany({
      where: {
        expiraEm: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: { in: ['PENDENTE', 'EXPIRADO', 'CANCELADO'] },
      },
    });

    const acoesPrevistas: string[] = [];
    if (dados.acao === AcaoChatbotCadastro.CADASTRAR_HARDWARE) {
      acoesPrevistas.push(
        hardwareBusca.registro ? 'REUTILIZAR_HARDWARE' : 'CRIAR_HARDWARE',
      );
    } else {
      if (ehHardwareTecnico) {
        acoesPrevistas.push(
          hardwareBusca.registro ? 'REUTILIZAR_HARDWARE' : 'CRIAR_HARDWARE',
        );
      }
      acoesPrevistas.push(
        produtoBusca.registro ? 'REUTILIZAR_PRODUTO' : 'CRIAR_PRODUTO',
      );
      acoesPrevistas.push(
        ofertaExistente ? 'ATUALIZAR_OFERTA' : 'CRIAR_OFERTA',
      );
      acoesPrevistas.push('PUBLICAR_PRODUTO');
    }

    return {
      status: 'AGUARDANDO_CONFIRMACAO' as const,
      tokenConfirmacao: token,
      expiraEm,
      acao: dados.acao,
      analise: {
        categoria,
        categoriaSlug,
        tipoCadastro:
          dados.acao === AcaoChatbotCadastro.CADASTRAR_HARDWARE
            ? 'HARDWARE'
            : ehHardwareTecnico
              ? 'HARDWARE_PRODUTO_OFERTA'
              : 'PRODUTO_OFERTA',
        hardware: {
          existente: Boolean(hardwareBusca.registro),
          id: hardwareBusca.registro?.id ?? null,
          criterio: hardwareBusca.criterio,
          confianca: this.confiancaCriterio(hardwareBusca.criterio),
          dadosDetectados: ehHardwareTecnico ? payload : null,
          candidatos: hardwareBusca.candidatos,
          camposPreenchiveis: hardwareComparacao.preenchiveis,
          conflitos: hardwareComparacao.conflitos,
        },
        produto: {
          existente: Boolean(produtoBusca.registro),
          id: produtoBusca.registro?.id ?? null,
          criterio: produtoBusca.criterio,
          confianca: this.confiancaCriterio(produtoBusca.criterio),
          categoriaId: categoriaProdutoId,
          dadosDetectados: payload,
          especificacoesEncontradas:
            resultadoIa.especificacoesEncontradas ?? {},
          informacoesProdutoEncontradas:
            resultadoIa.informacoesProdutoEncontradas ?? [],
          candidatos: produtoBusca.candidatos,
          camposPreenchiveis: produtoComparacao.preenchiveis,
          conflitos: produtoComparacao.conflitos,
        },
        oferta: {
          existente: Boolean(ofertaExistente),
          id: ofertaExistente?.id ?? null,
          dadosDetectados: snapshot.oferta,
          parceiro,
        },
        servicoProdutoIa: snapshot.servicoProdutoIa,
      },
      acoesPrevistas,
      avisos,
      camposObrigatoriosAusentes: Array.isArray(
        resultadoIa.camposObrigatoriosAusentes,
      )
        ? resultadoIa.camposObrigatoriosAusentes
        : [],
      conflitos: [
        ...hardwareComparacao.conflitos.map((item) => ({
          entidade: 'HARDWARE',
          ...item,
        })),
        ...produtoComparacao.conflitos.map((item) => ({
          entidade: 'PRODUTO',
          ...item,
        })),
      ],
      podeConfirmar,
      confirmacaoObrigatoria: true,
      nenhumRegistroCriado: true,
    };
  }

  private confiancaCriterio(criterio: CriterioDuplicidade): number | null {
    if (criterio === 'HARDWARE_VINCULADO') return 1;
    if (criterio === 'GTIN') return 1;
    if (criterio === 'MPN_MARCA') return 0.99;
    if (criterio === 'MARCA_MODELO') return 0.96;
    if (criterio === 'NOME_MARCA') return 0.86;
    return null;
  }

  private snapshot(valor: Prisma.JsonValue): SnapshotCadastro {
    if (!this.ehRegistro(valor)) {
      throw new BadRequestException('Token de confirmação inválido.');
    }
    return valor as unknown as SnapshotCadastro;
  }

  private reconciliacao(valor: Prisma.JsonValue): ReconciliacaoToken {
    if (!this.ehRegistro(valor)) {
      throw new BadRequestException('Reconciliação do token inválida.');
    }
    return valor as unknown as ReconciliacaoToken;
  }

  private async validarHardwareDto(
    payload: Record<string, unknown>,
    categoria: CategoriaHardware,
  ): Promise<CriarHardwareDto> {
    const payloadLimpo = this.removerNulos(payload) as Record<string, unknown>;
    const instancia = plainToInstance(CriarHardwareDto, {
      ...payloadLimpo,
      categoria,
      publicado: true,
      ativo: true,
    });
    const erros = await validate(instancia, {
      whitelist: true,
      forbidNonWhitelisted: false,
      validationError: { target: false, value: false },
    });
    if (erros.length > 0) {
      const mensagens = erros.flatMap((erro) =>
        erro.constraints ? Object.values(erro.constraints) : [],
      );
      throw new BadRequestException(
        mensagens.length > 0
          ? mensagens.join(' ')
          : 'Os dados do Hardware ainda estão incompletos ou inválidos.',
      );
    }
    return instancia;
  }

  private async hardwareSelecionado(
    tx: Prisma.TransactionClient,
    id: number,
    categoria: CategoriaHardware,
  ) {
    const hardware = await tx.hardware.findFirst({
      where: { id, ativo: true },
      include: { produto: { select: { id: true } } },
    });
    if (!hardware)
      throw new NotFoundException('Hardware não encontrado ou inativo.');
    if (hardware.categoria !== categoria) {
      throw new BadRequestException(
        'O Hardware selecionado não pertence à categoria detectada.',
      );
    }
    return hardware;
  }

  private async completarHardwareRaiz(
    tx: Prisma.TransactionClient,
    hardwareId: number,
    payload: Record<string, unknown>,
  ) {
    const atual = await tx.hardware.findUnique({
      where: { id: hardwareId },
      select: {
        id: true,
        descricao: true,
        mpn: true,
        gtin: true,
        imagemUrl: true,
        publicado: true,
        ativo: true,
      },
    });
    if (!atual) throw new NotFoundException('Hardware não encontrado.');

    const descricao = this.texto(payload.descricao);
    const atualizarDescricaoImportada = Boolean(
      descricao &&
      descricao !== atual.descricao &&
      descricao.length <= 1_200 &&
      (atual.descricao === null ||
        atual.descricao.length > 1_200 ||
        atual.descricao.length > descricao.length * 1.8),
    );
    const mpn = this.texto(payload.mpn);
    const gtin = this.texto(payload.gtin);
    const imagemUrl = this.texto(payload.imagemUrl);
    const data: Prisma.HardwareUpdateInput = {
      ...(atualizarDescricaoImportada && descricao ? { descricao } : {}),
      ...(atual.mpn === null && mpn ? { mpn } : {}),
      ...(atual.gtin === null && gtin ? { gtin } : {}),
      ...(atual.imagemUrl === null && imagemUrl ? { imagemUrl } : {}),
      ...(!atual.publicado ? { publicado: true } : {}),
      ...(!atual.ativo ? { ativo: true } : {}),
    };

    if (Object.keys(data).length > 0) {
      await tx.hardware.update({ where: { id: hardwareId }, data });
    }
  }

  private async produtoSelecionado(tx: Prisma.TransactionClient, id: number) {
    const produto = await tx.produto.findFirst({
      where: { id, ativo: true },
      include: { hardware: true, categoria: true },
    });
    if (!produto)
      throw new NotFoundException('Produto não encontrado ou inativo.');
    return produto;
  }

  private async completarProdutoRaiz(
    tx: Prisma.TransactionClient,
    produtoId: number,
    payload: Record<string, unknown>,
  ) {
    const atual = await tx.produto.findUnique({
      where: { id: produtoId },
      select: {
        id: true,
        marca: true,
        modelo: true,
        descricao: true,
        mpn: true,
        gtin: true,
        imagemUrl: true,
        metadados: true,
        publicado: true,
        ativo: true,
      },
    });
    if (!atual) throw new NotFoundException('Produto não encontrado.');

    const marca = this.texto(payload.marca);
    const modelo = this.texto(payload.modelo);
    const descricao = this.texto(payload.descricao);
    const atualizarDescricaoImportada = Boolean(
      descricao &&
      descricao !== atual.descricao &&
      descricao.length <= 1_200 &&
      (atual.descricao === null ||
        atual.descricao.length > 1_200 ||
        atual.descricao.length > descricao.length * 1.8),
    );
    const mpn = this.texto(payload.mpn);
    const gtin = this.texto(payload.gtin);
    const imagemUrl = this.texto(payload.imagemUrl);
    const metadados =
      this.ehRegistro(payload.metadados) && atual.metadados === null
        ? (payload.metadados as Prisma.InputJsonValue)
        : undefined;
    const data: Prisma.ProdutoUpdateInput = {
      ...(atual.marca === null && marca ? { marca } : {}),
      ...(atual.modelo === null && modelo ? { modelo } : {}),
      ...(atualizarDescricaoImportada && descricao ? { descricao } : {}),
      ...(atual.mpn === null && mpn ? { mpn } : {}),
      ...(atual.gtin === null && gtin ? { gtin } : {}),
      ...(atual.imagemUrl === null && imagemUrl ? { imagemUrl } : {}),
      ...(metadados ? { metadados } : {}),
      publicado: true,
      ativo: true,
    };
    if (Object.keys(data).length > 0) {
      await tx.produto.update({ where: { id: produtoId }, data });
    }
  }

  private async criarProdutoHardware(
    tx: Prisma.TransactionClient,
    hardware: {
      id: number;
      produtoId: number | null;
      nome: string;
      marca: string;
      modelo: string;
      descricao: string | null;
      mpn: string | null;
      gtin: string | null;
      imagemUrl: string | null;
      imagemHoverUrl: string | null;
      categoria: CategoriaHardware;
    },
    payload: Record<string, unknown>,
  ) {
    if (hardware.produtoId)
      return this.produtoSelecionado(tx, hardware.produtoId);
    const mapa = CATEGORIA_PRODUTO_HARDWARE[hardware.categoria];
    if (!mapa) {
      throw new BadRequestException(
        'Categoria técnica sem categoria comercial correspondente.',
      );
    }
    const categoria = await tx.categoriaProduto.upsert({
      where: { slug: mapa.slug },
      update: {},
      create: {
        nome: mapa.nome,
        slug: mapa.slug,
        grupo: GrupoCategoriaProduto.COMPONENTES,
        ativo: true,
      },
    });
    const nome = this.texto(payload.nome) ?? hardware.nome;
    const marca = this.texto(payload.marca) ?? hardware.marca;
    const modelo = this.texto(payload.modelo) ?? hardware.modelo;
    await assertCatalogIdentityAvailable(
      tx,
      {
        nome,
        marca,
        modelo,
        mpn: this.texto(payload.mpn) ?? hardware.mpn,
        gtin: this.texto(payload.gtin) ?? hardware.gtin,
      },
      { hardwareOriginId: hardware.id },
    );
    const slug = await this.criarSlugProdutoUnico(
      tx,
      `${marca} ${modelo} ${nome}`,
    );
    const produto = await tx.produto.create({
      data: {
        categoriaId: categoria.id,
        tipo: TipoProduto.HARDWARE,
        nome,
        slug,
        marca,
        modelo,
        descricao: this.texto(payload.descricao) ?? hardware.descricao,
        mpn: this.texto(payload.mpn) ?? hardware.mpn,
        gtin: this.texto(payload.gtin) ?? hardware.gtin,
        imagemUrl: this.texto(payload.imagemUrl) ?? hardware.imagemUrl,
        imagemHoverUrl: hardware.imagemHoverUrl,
        publicado: true,
        ativo: true,
      },
      include: { hardware: true, categoria: true },
    });
    await tx.hardware.update({
      where: { id: hardware.id },
      data: { produtoId: produto.id },
    });
    return this.produtoSelecionado(tx, produto.id);
  }

  private async criarProdutoGenerico(
    tx: Prisma.TransactionClient,
    categoriaId: number,
    payload: Record<string, unknown>,
  ) {
    const categoria = await tx.categoriaProduto.findFirst({
      where: { id: categoriaId, ativo: true },
    });
    if (!categoria)
      throw new NotFoundException(
        'Categoria de Produto não encontrada ou inativa.',
      );
    const nome = this.texto(payload.nome);
    if (!nome)
      throw new BadRequestException('O nome do Produto é obrigatório.');
    const marca = this.texto(payload.marca);
    const modelo = this.texto(payload.modelo);
    await assertCatalogIdentityAvailable(tx, {
      nome,
      marca,
      modelo,
      mpn: this.texto(payload.mpn),
      gtin: this.texto(payload.gtin),
    });
    const slug = await this.criarSlugProdutoUnico(
      tx,
      `${marca ?? ''} ${modelo ?? ''} ${nome}`,
    );
    return tx.produto.create({
      data: {
        categoriaId,
        tipo: TipoProduto.GENERICO,
        nome,
        slug,
        marca,
        modelo,
        descricao: this.texto(payload.descricao),
        mpn: this.texto(payload.mpn),
        gtin: this.texto(payload.gtin),
        imagemUrl: this.texto(payload.imagemUrl),
        ...(this.ehRegistro(payload.metadados)
          ? { metadados: payload.metadados as Prisma.InputJsonValue }
          : {}),
        publicado: true,
        ativo: true,
      },
      include: { hardware: true, categoria: true },
    });
  }

  private async resolverParceiro(
    tx: Prisma.TransactionClient,
    snapshot: SnapshotCadastro,
    ajustes?: AjustesCadastroChatbotDto,
  ) {
    const parceiroId = ajustes?.parceiroId ?? snapshot.parceiro?.id ?? null;
    if (!parceiroId) {
      throw new BadRequestException(
        'Selecione o parceiro/loja antes de confirmar.',
      );
    }
    const parceiro = await tx.parceiro.findFirst({
      where: { id: parceiroId, ativo: true },
    });
    if (!parceiro)
      throw new NotFoundException('Parceiro não encontrado ou inativo.');
    return parceiro;
  }

  private async criarOuAtualizarOferta(
    tx: Prisma.TransactionClient,
    produto: { id: number; hardware: { id: number } | null },
    snapshot: SnapshotCadastro,
    ajustes: AjustesCadastroChatbotDto | undefined,
    ofertaExistenteId: number | null,
  ) {
    const parceiro = await this.resolverParceiro(tx, snapshot, ajustes);
    const preco = ajustes?.preco ?? snapshot.oferta.preco;
    if (preco === null || !Number.isFinite(preco) || preco <= 0) {
      throw new BadRequestException(
        'A Oferta precisa possuir um preço válido.',
      );
    }
    const precoAnterior =
      ajustes?.precoAnterior ?? snapshot.oferta.precoAnterior;
    const urlOriginal = snapshot.oferta.urlOriginal;
    const urlObj = new URL(urlOriginal);
    const urlAfiliada =
      ajustes?.urlAfiliada?.trim() ||
      (this.ehMagazineVoceCriabyte(urlObj)
        ? urlOriginal
        : snapshot.oferta.urlAfiliada);
    const codigoMarketplace =
      ajustes?.codigoMarketplace?.trim() || snapshot.oferta.codigoMarketplace;
    const agora = new Date();

    let existente = ofertaExistenteId
      ? await tx.oferta.findUnique({ where: { id: ofertaExistenteId } })
      : null;
    if (!existente) {
      existente = await tx.oferta.findFirst({
        where: {
          produtoId: produto.id,
          parceiroId: parceiro.id,
          OR: [
            { urlOriginal },
            ...(codigoMarketplace ? [{ codigoMarketplace }] : []),
          ],
        },
      });
    }

    if (existente) {
      const mudouPreco = Number(existente.preco) !== preco;
      const atualizada = await tx.oferta.update({
        where: { id: existente.id },
        data: {
          hardwareId: produto.hardware?.id ?? null,
          parceiroId: parceiro.id,
          urlOriginal,
          urlAfiliada: urlAfiliada || null,
          codigoMarketplace: codigoMarketplace || null,
          preco,
          precoAnterior:
            precoAnterior ??
            (mudouPreco ? existente.preco : existente.precoAnterior),
          status:
            snapshot.oferta.disponivel === false
              ? StatusOferta.INDISPONIVEL
              : StatusOferta.ATIVA,
          verificadoEm: agora,
          coletadoEm: agora,
        },
      });
      if (mudouPreco) {
        await tx.historicoPrecoOferta.create({
          data: { ofertaId: existente.id, preco, verificadoEm: agora },
        });
      }
      return { registro: atualizada, acao: 'ATUALIZADA' as const };
    }

    const criada = await tx.oferta.create({
      data: {
        produtoId: produto.id,
        hardwareId: produto.hardware?.id ?? null,
        parceiroId: parceiro.id,
        urlOriginal,
        urlAfiliada: urlAfiliada || null,
        codigoMarketplace: codigoMarketplace || null,
        preco,
        precoAnterior,
        status:
          snapshot.oferta.disponivel === false
            ? StatusOferta.INDISPONIVEL
            : StatusOferta.ATIVA,
        verificadoEm: agora,
        coletadoEm: agora,
        historicoPrecos: {
          create: { preco, verificadoEm: agora },
        },
      },
    });
    return { registro: criada, acao: 'CRIADA' as const };
  }

  async confirmarCadastro(
    usuarioId: number,
    dados: ConfirmarCadastroChatbotDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const agora = new Date();
      const reivindicado = await tx.chatbotCadastroToken.updateMany({
        where: {
          token: dados.tokenConfirmacao,
          usuarioId,
          status: 'PENDENTE',
          expiraEm: { gt: agora },
        },
        data: { status: 'PROCESSANDO' },
      });

      if (reivindicado.count === 0) {
        const atual = await tx.chatbotCadastroToken.findUnique({
          where: { token: dados.tokenConfirmacao },
        });
        if (!atual || atual.usuarioId !== usuarioId) {
          throw new NotFoundException('Token de confirmação não encontrado.');
        }
        if (atual.status === 'CONSUMIDO' && atual.resultadoFinal) {
          return atual.resultadoFinal as Record<string, unknown>;
        }
        if (atual.status === 'CANCELADO') {
          return { status: 'CANCELADO', nenhumRegistroCriado: true };
        }
        if (atual.expiraEm <= agora || atual.status === 'EXPIRADO') {
          await tx.chatbotCadastroToken.updateMany({
            where: { id: atual.id, status: 'PENDENTE' },
            data: { status: 'EXPIRADO' },
          });
          throw new BadRequestException(
            'O token de confirmação expirou. Analise a URL novamente.',
          );
        }
        throw new ConflictException(
          'Este token já está sendo processado ou não pode mais ser utilizado.',
        );
      }

      const token = await tx.chatbotCadastroToken.findUnique({
        where: { token: dados.tokenConfirmacao },
      });
      if (!token)
        throw new NotFoundException('Token de confirmação não encontrado.');

      if (!dados.confirmar) {
        const resultado = {
          status: 'CANCELADO' as const,
          nenhumRegistroCriado: true,
        };
        await tx.chatbotCadastroToken.update({
          where: { id: token.id },
          data: {
            status: 'CANCELADO',
            consumidoEm: agora,
            resultadoFinal: resultado,
          },
        });
        return resultado;
      }

      const snapshot = this.snapshot(token.resultadoNormalizado);
      const reconciliacao = this.reconciliacao(token.reconciliacao);
      const payload = {
        ...snapshot.hardware,
        ...(dados.ajustes?.dadosCorrigidos ?? {}),
      };
      const categoriaInformada = ehCategoriaImportacaoIa(
        dados.ajustes?.categoria,
      )
        ? dados.ajustes?.categoria
        : null;
      const categoriaFinal = categoriaInformada ?? snapshot.categoria;
      const categoriaTecnica = this.categoriaTecnica(categoriaFinal);
      const categoriaSlugFinal = categoriaFinal
        ? (SLUGS_PRODUTO[categoriaFinal] ??
          (categoriaTecnica
            ? CATEGORIA_PRODUTO_HARDWARE[categoriaTecnica]?.slug
            : null))
        : snapshot.categoriaSlug;
      if (categoriaTecnica && !this.texto(payload.categoria)) {
        payload.categoria = categoriaTecnica;
      }
      const acao = token.acao as AcaoChatbotCadastro;

      let hardware: Awaited<
        ReturnType<typeof this.hardwareSelecionado>
      > | null = null;
      let hardwareAcao: 'CRIADO' | 'REUTILIZADO' | null = null;

      if (categoriaTecnica) {
        const hardwareId =
          dados.ajustes?.hardwareId ?? reconciliacao.hardwareExistenteId;
        if (hardwareId) {
          hardware = await this.hardwareSelecionado(
            tx,
            hardwareId,
            categoriaTecnica,
          );
          await this.completarHardwareRaiz(tx, hardware.id, payload);
          hardwareAcao = 'REUTILIZADO';
        } else {
          const dto = await this.validarHardwareDto(payload, categoriaTecnica);
          const criado = await this.hardwaresService.criarEmTransacao(tx, dto);
          hardware = await this.hardwareSelecionado(
            tx,
            criado.id,
            categoriaTecnica,
          );
          hardwareAcao = 'CRIADO';
        }
      } else if (acao === AcaoChatbotCadastro.CADASTRAR_HARDWARE) {
        throw new BadRequestException(
          'A categoria detectada não pode ser cadastrada como Hardware técnico.',
        );
      }

      if (acao === AcaoChatbotCadastro.CADASTRAR_HARDWARE) {
        if (!hardware || !hardwareAcao) {
          throw new BadRequestException(
            'Não foi possível resolver o Hardware.',
          );
        }
        const resultado = {
          status: 'CONCLUIDO' as const,
          hardware: { acao: hardwareAcao, id: hardware.id },
          produto: null,
          oferta: null,
        };
        await tx.chatbotCadastroToken.update({
          where: { id: token.id },
          data: {
            status: 'CONSUMIDO',
            consumidoEm: agora,
            resultadoFinal: resultado,
          },
        });
        return resultado;
      }

      let produto: Awaited<ReturnType<typeof this.produtoSelecionado>> | null =
        null;
      let produtoAcao: 'CRIADO' | 'REUTILIZADO' = 'REUTILIZADO';
      const produtoId =
        dados.ajustes?.produtoId ?? reconciliacao.produtoExistenteId;
      if (produtoId) {
        produto = await this.produtoSelecionado(tx, produtoId);
        if (
          categoriaSlugFinal &&
          produto.categoria.slug !== categoriaSlugFinal
        ) {
          throw new BadRequestException(
            'O Produto selecionado pertence a outra categoria comercial.',
          );
        }
        if (categoriaTecnica && hardware) {
          if (produto.hardware && produto.hardware.id !== hardware.id) {
            throw new ConflictException(
              'O Produto selecionado já está vinculado a outro Hardware.',
            );
          }
          if (!produto.hardware) {
            if (hardware.produtoId && hardware.produtoId !== produto.id) {
              throw new ConflictException(
                'O Hardware selecionado já está vinculado a outro Produto.',
              );
            }
            await tx.hardware.update({
              where: { id: hardware.id },
              data: { produtoId: produto.id },
            });
            produto = await this.produtoSelecionado(tx, produto.id);
          }
        }
        await this.completarProdutoRaiz(tx, produto.id, payload);
      } else if (categoriaTecnica && hardware) {
        produto = await this.criarProdutoHardware(tx, hardware, payload);
        produtoAcao = 'CRIADO';
      } else {
        const categoriaId =
          dados.ajustes?.categoriaId ??
          (categoriaSlugFinal
            ? ((
                await tx.categoriaProduto.findUnique({
                  where: { slug: categoriaSlugFinal },
                  select: { id: true },
                })
              )?.id ?? null)
            : null);
        if (!categoriaId) {
          throw new BadRequestException(
            'Selecione a categoria comercial do Produto antes de confirmar.',
          );
        }
        produto = await this.criarProdutoGenerico(tx, categoriaId, payload);
        produtoAcao = 'CRIADO';
      }

      if (!produto)
        throw new BadRequestException('Não foi possível resolver o Produto.');

      // Confirmação pelo Assistente Admin significa aprovação editorial:
      // o Produto deve sair do fluxo já ativo e publicado na Loja, inclusive
      // quando um registro existente foi reutilizado.
      if (!produto.publicado || !produto.ativo) {
        await tx.produto.update({
          where: { id: produto.id },
          data: { publicado: true, ativo: true },
        });
        produto = await this.produtoSelecionado(tx, produto.id);
      }

      const oferta = await this.criarOuAtualizarOferta(
        tx,
        {
          id: produto.id,
          hardware: produto.hardware ? { id: produto.hardware.id } : null,
        },
        snapshot,
        dados.ajustes,
        reconciliacao.ofertaExistenteId,
      );

      const resultado = {
        status: 'CONCLUIDO' as const,
        hardware: hardware ? { acao: hardwareAcao, id: hardware.id } : null,
        produto: { acao: produtoAcao, id: produto.id },
        oferta: { acao: oferta.acao, id: oferta.registro.id },
      };

      await tx.chatbotCadastroToken.update({
        where: { id: token.id },
        data: {
          status: 'CONSUMIDO',
          consumidoEm: agora,
          resultadoFinal: resultado,
        },
      });
      return resultado;
    });
  }
}
