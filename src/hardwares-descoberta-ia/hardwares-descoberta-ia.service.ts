import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CategoriaHardware } from '../generated/prisma/enums';
import { CriarHardwareDto } from '../hardwares/dtos/criar-hardware.dto';
import { HardwaresService } from '../hardwares/hardwares.service';
import {
  ProdutoIaPythonService,
  type ResultadoDescobertaHardwareProdutoIa,
} from '../ia/produto-ia-python.service';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrarHardwareDescobertoDto } from './dtos/cadastrar-hardware-descoberto.dto';
import { DescobrirHardwaresDto } from './dtos/descobrir-hardwares.dto';
import { EnriquecerIaTecnicaDto } from './dtos/enriquecer-ia-tecnica.dto';
import { EnriquecerMetaAiWhatsappDto } from './dtos/enriquecer-meta-ai-whatsapp.dto';

const CATEGORIAS_DESCOBERTA = new Set<CategoriaHardware>([
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

const CAMPOS_ESPECIFICACAO = [
  'especificacaoProcessador',
  'especificacaoPlacaMae',
  'especificacaoMemoriaRam',
  'especificacaoPlacaVideo',
  'especificacaoArmazenamento',
  'especificacaoFonte',
  'especificacaoGabinete',
  'especificacaoCooler',
  'especificacaoVentoinha',
  'especificacoes',
] as const;

type HardwareBancoResumo = {
  id: number;
  nome: string;
  marca: string;
  modelo: string;
  mpn: string | null;
  gtin: string | null;
  categoria: CategoriaHardware;
};

type CriterioDuplicidade = 'GTIN' | 'MPN_MARCA' | 'MARCA_MODELO' | 'NOME_MARCA';

type CandidatoNormalizado = {
  idTemporario: string;
  statusFicha: 'PRONTO' | 'PRECISA_REVISAO' | 'FICHA_INCOMPLETA';
  qualidade: number;
  fontes: string[];
  avisos: string[];
  metaAiWhatsappFallback?: Record<string, unknown>;
  payload: CriarHardwareDto;
};

@Injectable()
export class HardwaresDescobertaIaService {
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

  private ehLacuna(valor: unknown): boolean {
    if (valor === null || valor === undefined) return true;
    if (typeof valor === 'string') return valor.trim().length === 0;
    if (Array.isArray(valor)) return valor.length === 0;
    if (this.ehRegistro(valor)) return Object.keys(valor).length === 0;
    return false;
  }

  private mesclarSomenteLacunas(atual: unknown, sugerido: unknown): unknown {
    if (this.ehRegistro(atual) && this.ehRegistro(sugerido)) {
      const mesclado: Record<string, unknown> = { ...atual };

      for (const [campo, valorSugerido] of Object.entries(sugerido)) {
        mesclado[campo] = this.mesclarSomenteLacunas(
          atual[campo],
          valorSugerido,
        );
      }

      return mesclado;
    }

    if (this.ehLacuna(atual) && !this.ehLacuna(sugerido)) {
      return sugerido;
    }

    return atual;
  }

  private camposPreenchidosPorEnriquecimento(
    antes: unknown,
    depois: unknown,
    caminho = '',
  ): string[] {
    if (this.ehRegistro(depois)) {
      const antesRegistro = this.ehRegistro(antes) ? antes : {};
      return Object.entries(depois).flatMap(([campo, valorDepois]) => {
        const proximoCaminho = caminho ? `${caminho}.${campo}` : campo;
        return this.camposPreenchidosPorEnriquecimento(
          antesRegistro[campo],
          valorDepois,
          proximoCaminho,
        );
      });
    }

    if (this.ehLacuna(antes) && !this.ehLacuna(depois) && caminho) {
      const partes = caminho.split('.');
      return [partes[partes.length - 1] ?? caminho];
    }

    return [];
  }

  private normalizar(valor: unknown): string {
    const texto = this.texto(valor);
    if (!texto) return '';
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, ' ')
      .trim()
      .replace(/\s+/gu, ' ');
  }

  private categoriaPermitida(categoria: CategoriaHardware): void {
    if (!CATEGORIAS_DESCOBERTA.has(categoria)) {
      throw new BadRequestException(
        `${categoria} não participa do catálogo técnico de descoberta de Hardwares.`,
      );
    }
  }

  private extrairItens(
    resultado: ResultadoDescobertaHardwareProdutoIa,
  ): unknown[] {
    if (Array.isArray(resultado.itens)) return resultado.itens;
    if (Array.isArray(resultado.hardwares)) return resultado.hardwares;
    if (Array.isArray(resultado.resultados)) return resultado.resultados;
    if (Array.isArray(resultado.dados)) return resultado.dados;
    return [];
  }

  private extrairPayload(item: unknown): Record<string, unknown> | null {
    if (!this.ehRegistro(item)) return null;
    if (this.ehRegistro(item.payload)) return item.payload;
    if (
      this.ehRegistro(item.cadastroSugerido) &&
      this.ehRegistro(item.cadastroSugerido.payload)
    ) {
      return item.cadastroSugerido.payload;
    }
    if (this.ehRegistro(item.payloadParcialBackend)) {
      return item.payloadParcialBackend;
    }
    return item;
  }

  private extrairFontes(item: unknown): string[] {
    if (!this.ehRegistro(item)) return [];

    const valores: unknown[] = [];

    const fontesItem = item.fontes;
    if (Array.isArray(fontesItem)) {
      valores.push(...(fontesItem as unknown[]));
    }

    const proveniencia = item.proveniencia;
    if (this.ehRegistro(proveniencia)) {
      const fontesProveniencia = proveniencia.fontes;

      if (Array.isArray(fontesProveniencia)) {
        valores.push(...(fontesProveniencia as unknown[]));
      }
    }

    if (this.ehRegistro(item.origemColeta)) {
      const fonte = this.texto(item.origemColeta.fonte);
      if (fonte) valores.push(fonte);
    }

    return [
      ...new Set(
        valores
          .map((valor) => this.texto(valor))
          .filter((valor): valor is string => Boolean(valor)),
      ),
    ];
  }
  private extrairMetaAiWhatsappFallback(
    item: unknown,
  ): Record<string, unknown> | null {
    if (!this.ehRegistro(item)) return null;
    if (!this.ehRegistro(item.metaAiWhatsappFallback)) return null;

    return { ...item.metaAiWhatsappFallback };
  }

  private especificacaoDoPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> | null {
    for (const campo of CAMPOS_ESPECIFICACAO) {
      const valor = payload[campo];
      if (this.ehRegistro(valor) && Object.keys(valor).length > 0) return valor;
    }
    return null;
  }

  private qualidadeCalculada(payload: Record<string, unknown>): number {
    const pontos = [
      this.texto(payload.nome),
      this.texto(payload.marca),
      this.texto(payload.modelo),
      this.texto(payload.categoria),
      this.especificacaoDoPayload(payload),
    ].filter(Boolean).length;
    return pontos * 20;
  }

  private qualidadeDoItem(
    item: unknown,
    payload: Record<string, unknown>,
  ): number {
    if (this.ehRegistro(item)) {
      const informado = item.qualidade ?? item.qualidadeFicha;
      if (typeof informado === 'number' && Number.isFinite(informado)) {
        return Math.max(0, Math.min(100, Math.round(informado)));
      }
    }
    return this.qualidadeCalculada(payload);
  }

  private payloadCriacao(
    bruto: Record<string, unknown>,
    categoriaSolicitada: CategoriaHardware,
  ): { payload: CriarHardwareDto | null; avisos: string[] } {
    const avisos: string[] = [];
    const nome = this.texto(bruto.nome);
    const marca = this.texto(bruto.marca);
    const modelo = this.texto(bruto.modelo);
    const categoriaInformada = this.texto(bruto.categoria);

    if (!nome || !marca || !modelo) return { payload: null, avisos };

    if (categoriaInformada && categoriaInformada !== categoriaSolicitada) {
      return {
        payload: null,
        avisos: [
          `A IA devolveu categoria ${categoriaInformada}; a busca foi solicitada para ${categoriaSolicitada}.`,
        ],
      };
    }

    const payload: Record<string, unknown> = {
      nome,
      marca,
      modelo,
      categoria: categoriaSolicitada,
      publicado: false,
      ativo: true,
    };

    for (const campo of [
      'descricao',
      'mpn',
      'gtin',
      'imagemUrl',
      'imagemHoverUrl',
      ...CAMPOS_ESPECIFICACAO,
    ]) {
      if (bruto[campo] !== undefined && bruto[campo] !== null) {
        payload[campo] = bruto[campo];
      }
    }

    return { payload: payload as unknown as CriarHardwareDto, avisos };
  }

  private idTemporario(payload: CriarHardwareDto): string {
    const base = `${payload.categoria}|${payload.marca}|${payload.modelo}|${payload.mpn ?? ''}|${payload.gtin ?? ''}`;
    const hash = createHash('sha256').update(base).digest('hex').slice(0, 12);
    const slug = this.normalizar(`${payload.marca} ${payload.modelo}`)
      .replace(/\s+/gu, '-')
      .slice(0, 80);
    return `${slug || 'hardware'}-${hash}`;
  }

  private statusFicha(
    item: unknown,
    payload: CriarHardwareDto,
    qualidade: number,
    avisos: string[],
  ): CandidatoNormalizado['statusFicha'] {
    if (this.ehRegistro(item)) {
      const status = this.texto(item.statusFicha)?.toUpperCase();
      if (status === 'PRONTO')
        return avisos.length ? 'PRECISA_REVISAO' : 'PRONTO';
      if (status === 'PRECISA_REVISAO' || status === 'REVISAO')
        return 'PRECISA_REVISAO';
      if (status === 'FICHA_INCOMPLETA' || status === 'INCOMPLETO')
        return 'FICHA_INCOMPLETA';
    }

    if (
      !this.especificacaoDoPayload(
        payload as unknown as Record<string, unknown>,
      )
    ) {
      return 'FICHA_INCOMPLETA';
    }
    if (avisos.length || qualidade < 80) return 'PRECISA_REVISAO';
    return 'PRONTO';
  }

  private localizarDuplicado(
    payload: CriarHardwareDto,
    existentes: HardwareBancoResumo[],
  ): { hardware: HardwareBancoResumo; criterio: CriterioDuplicidade } | null {
    const gtin = this.normalizar(payload.gtin);
    const mpn = this.normalizar(payload.mpn);
    const marca = this.normalizar(payload.marca);
    const modelo = this.normalizar(payload.modelo);
    const nome = this.normalizar(payload.nome);

    if (gtin) {
      const hardware = existentes.find(
        (registro) => this.normalizar(registro.gtin) === gtin,
      );
      if (hardware) return { hardware, criterio: 'GTIN' };
    }
    if (mpn && marca) {
      const hardware = existentes.find(
        (registro) =>
          this.normalizar(registro.mpn) === mpn &&
          this.normalizar(registro.marca) === marca,
      );
      if (hardware) return { hardware, criterio: 'MPN_MARCA' };
    }
    if (marca && modelo) {
      const hardware = existentes.find(
        (registro) =>
          this.normalizar(registro.marca) === marca &&
          this.normalizar(registro.modelo) === modelo,
      );
      if (hardware) return { hardware, criterio: 'MARCA_MODELO' };
    }
    if (nome && marca) {
      const hardware = existentes.find(
        (registro) =>
          this.normalizar(registro.nome) === nome &&
          this.normalizar(registro.marca) === marca,
      );
      if (hardware) return { hardware, criterio: 'NOME_MARCA' };
    }
    return null;
  }

  private chaveInterna(payload: CriarHardwareDto): string {
    const gtin = this.normalizar(payload.gtin);
    const mpn = this.normalizar(payload.mpn);
    const marca = this.normalizar(payload.marca);
    const modelo = this.normalizar(payload.modelo);
    const nome = this.normalizar(payload.nome);

    if (gtin) return `gtin:${gtin}`;
    if (mpn && marca) return `mpn-marca:${mpn}|${marca}`;
    if (marca && modelo) return `marca-modelo:${marca}|${modelo}`;
    return `nome-marca:${nome}|${marca}`;
  }

  async descobrir(dados: DescobrirHardwaresDto) {
    this.categoriaPermitida(dados.categoria);
    const limite = Math.min(Math.max(dados.limite ?? 50, 1), 100);
    const pagina = Math.max(dados.pagina ?? 1, 1);
    const marca = dados.marca?.trim() || undefined;

    const resultadoIa = await this.produtoIa.descobrirHardwares({
      categoria: dados.categoria,
      marca,
      limite,
      pagina,
    });

    const itensBrutos = this.extrairItens(resultadoIa);
    if (itensBrutos.length === 0 && resultadoIa.erro) {
      throw new BadGatewayException(
        `A Produto IA não conseguiu descobrir Hardwares: ${resultadoIa.erro}`,
      );
    }

    const existentes = await this.prisma.hardware.findMany({
      select: {
        id: true,
        nome: true,
        marca: true,
        modelo: true,
        mpn: true,
        gtin: true,
        categoria: true,
      },
    });

    const novos: CandidatoNormalizado[] = [];
    const chavesNovas = new Set<string>();
    let jaCadastrados = 0;
    let duplicadosNaBusca = 0;
    let descartadosInvalidos = 0;

    for (const item of itensBrutos) {
      const bruto = this.extrairPayload(item);
      if (!bruto) {
        descartadosInvalidos += 1;
        continue;
      }

      const normalizado = this.payloadCriacao(bruto, dados.categoria);
      if (!normalizado.payload) {
        descartadosInvalidos += 1;
        continue;
      }

      const duplicado = this.localizarDuplicado(
        normalizado.payload,
        existentes,
      );
      if (duplicado) {
        jaCadastrados += 1;
        continue;
      }

      const chave = this.chaveInterna(normalizado.payload);
      if (chavesNovas.has(chave)) {
        duplicadosNaBusca += 1;
        continue;
      }
      chavesNovas.add(chave);

      const qualidade = this.qualidadeDoItem(item, bruto);
      const metaAiWhatsappFallback = this.extrairMetaAiWhatsappFallback(item);

      novos.push({
        idTemporario: this.idTemporario(normalizado.payload),
        statusFicha: this.statusFicha(
          item,
          normalizado.payload,
          qualidade,
          normalizado.avisos,
        ),
        qualidade,
        fontes: this.extrairFontes(item),
        avisos: normalizado.avisos,
        ...(metaAiWhatsappFallback ? { metaAiWhatsappFallback } : {}),
        payload: normalizado.payload,
      });
    }

    return {
      categoria: dados.categoria,
      marca: marca ?? null,
      pagina,
      limite,
      totalEncontrados: itensBrutos.length,
      jaCadastrados,
      duplicadosNaBusca,
      descartadosInvalidos,
      novos: novos.length,
      itens: novos,
      proximaPagina:
        typeof resultadoIa.proximaPagina === 'number'
          ? resultadoIa.proximaPagina
          : resultadoIa.temMais === true
            ? pagina + 1
            : null,
      temMais: resultadoIa.temMais ?? null,
      servicoProdutoIa: resultadoIa.servicoProdutoIa ?? null,
      nenhumRegistroCriado: true,
    };
  }

  async enriquecerIaTecnica(dados: EnriquecerIaTecnicaDto) {
    this.categoriaPermitida(dados.categoria);

    const nome =
      dados.nome?.trim() || this.texto(dados.payload.nome) || undefined;
    const somentePreencheLacunas = dados.somentePreencheLacunas ?? true;

    const resultado = await this.produtoIa.enriquecerIaTecnica({
      provedor: dados.provedor,
      categoria: dados.categoria,
      nome,
      payload: dados.payload,
      somentePreencheLacunas,
    });

    const payloadSugerido = this.ehRegistro(resultado.payload)
      ? resultado.payload
      : dados.payload;

    // Mesmo que o provider devolva algum valor conflitante, este proxy nunca
    // substitui dado já preenchido. O usuário continua revisando a prévia
    // antes de qualquer cadastro/atualização de Hardware.
    const payloadProtegido = this.mesclarSomenteLacunas(
      dados.payload,
      payloadSugerido,
    ) as Record<string, unknown>;

    const camposPreenchidos = [
      ...new Set(
        this.camposPreenchidosPorEnriquecimento(
          dados.payload,
          payloadProtegido,
        ),
      ),
    ];

    return {
      ...resultado,
      utilizado:
        typeof resultado.utilizado === 'boolean'
          ? resultado.utilizado
          : camposPreenchidos.length > 0,
      provedor: this.texto(resultado.provedor) ?? dados.provedor,
      categoria: this.texto(resultado.categoria) ?? dados.categoria,
      nome: this.texto(resultado.nome) ?? nome ?? null,
      somentePreencheLacunas,
      camposPreenchidos,
      camposAusentes: Array.isArray(resultado.camposAusentes)
        ? resultado.camposAusentes
        : [],
      coberturaAntes:
        typeof resultado.coberturaAntes === 'number'
          ? resultado.coberturaAntes
          : null,
      coberturaDepois:
        typeof resultado.coberturaDepois === 'number'
          ? resultado.coberturaDepois
          : null,
      statusFicha: this.texto(resultado.statusFicha),
      payload: payloadProtegido,
    };
  }

  async enriquecerMetaAiWhatsapp(dados: EnriquecerMetaAiWhatsappDto) {
    this.categoriaPermitida(dados.categoria);

    const nome =
      dados.nome?.trim() || this.texto(dados.payload.nome) || undefined;

    return this.produtoIa.enriquecerMetaAiWhatsapp({
      categoria: dados.categoria,
      nome,
      payload: dados.payload,
      resposta: dados.resposta,
      captura: dados.captura,
      forcar: dados.forcar ?? false,
    });
  }

  private async verificarAntesDeCadastrar(payload: CriarHardwareDto) {
    this.categoriaPermitida(payload.categoria);
    const existentes = await this.prisma.hardware.findMany({
      select: {
        id: true,
        nome: true,
        marca: true,
        modelo: true,
        mpn: true,
        gtin: true,
        categoria: true,
      },
    });
    return this.localizarDuplicado(payload, existentes);
  }

  async cadastrar(dados: CadastrarHardwareDescobertoDto) {
    const duplicado = await this.verificarAntesDeCadastrar(dados.payload);
    if (duplicado) {
      return {
        status: 'JA_EXISTE' as const,
        idTemporario: dados.idTemporario ?? null,
        hardware: {
          id: duplicado.hardware.id,
          nome: duplicado.hardware.nome,
        },
        criterio: duplicado.criterio,
      };
    }

    try {
      const hardware = await this.hardwaresService.criar({
        ...dados.payload,
        publicado: dados.payload.publicado ?? false,
        ativo: dados.payload.ativo ?? true,
      });
      return {
        status: 'CRIADO' as const,
        idTemporario: dados.idTemporario ?? this.idTemporario(dados.payload),
        hardware,
      };
    } catch (erro) {
      if (erro instanceof ConflictException) {
        const agoraDuplicado = await this.verificarAntesDeCadastrar(
          dados.payload,
        );
        if (agoraDuplicado) {
          return {
            status: 'JA_EXISTE' as const,
            idTemporario: dados.idTemporario ?? null,
            hardware: {
              id: agoraDuplicado.hardware.id,
              nome: agoraDuplicado.hardware.nome,
            },
            criterio: agoraDuplicado.criterio,
          };
        }
      }
      throw erro;
    }
  }

  async cadastrarLote(itens: CadastrarHardwareDescobertoDto[]) {
    const resultados: Array<Record<string, unknown>> = [];

    for (const item of itens) {
      try {
        resultados.push(await this.cadastrar(item));
      } catch (erro) {
        resultados.push({
          status: 'ERRO',
          idTemporario: item.idTemporario ?? null,
          nome: item.payload?.nome ?? null,
          motivo: erro instanceof Error ? erro.message : 'Falha desconhecida.',
        });
      }
    }

    return {
      totalSolicitado: itens.length,
      criados: resultados.filter((item) => item.status === 'CRIADO').length,
      jaExistiam: resultados.filter((item) => item.status === 'JA_EXISTE')
        .length,
      erros: resultados.filter((item) => item.status === 'ERRO').length,
      resultados,
    };
  }
}
