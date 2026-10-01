import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { validarUrlPublica } from '../common/security/external-http-security';
import { CategoriaHardware } from '../generated/prisma/enums';
import { HardwaresService } from '../hardwares/hardwares.service';
import { postProdutoIa } from '../ia/produto-ia-http';

const CATEGORIAS_COM_BUSCA_TECNICA = new Set<CategoriaHardware>([
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

type Registro = Record<string, unknown>;

type CandidatoImagem = {
  nome: string;
  marca: string;
  modelo: string;
  imagemUrl: string | null;
  urlOrigem: string | null;
  fonte: string | null;
  score: number;
  bruto: Registro;
};

type ImagemEncontrada = {
  imagemUrl: string;
  fonte: string | null;
  urlOrigem: string | null;
  nome: string;
  marca: string;
  modelo: string;
  score: number;
  criterio?: string | null;
};

@Injectable()
export class HardwareImageSearchService {
  constructor(private readonly hardwaresService: HardwaresService) {}

  private ehRegistro(valor: unknown): valor is Registro {
    return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
  }

  private texto(valor: unknown): string {
    return typeof valor === 'string' ? valor.trim() : '';
  }

  private normalizar(valor: unknown): string {
    return this.texto(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, ' ')
      .trim()
      .replace(/\s+/gu, ' ');
  }

  private payloadDoItem(item: Registro): Registro {
    if (this.ehRegistro(item.payload)) return item.payload;
    if (this.ehRegistro(item.payloadHardware)) return item.payloadHardware;
    if (this.ehRegistro(item.payloadParcialBackend)) {
      return item.payloadParcialBackend;
    }
    return item;
  }

  private pontuar(
    hardware: { nome: string; marca: string; modelo: string },
    item: Registro,
  ): CandidatoImagem {
    const payload = this.payloadDoItem(item);
    const nome = this.texto(payload.nome);
    const marca = this.texto(payload.marca);
    const modelo = this.texto(payload.modelo);
    const imagemUrl = this.texto(payload.imagemUrl) || null;
    const urlOrigem =
      this.texto(item.urlOrigem) ||
      this.texto(item.urlFontePrincipal) ||
      this.texto(item.url) ||
      null;
    const fonte =
      this.texto(item.fonteCatalogo) ||
      this.texto(item.fontePrincipal) ||
      this.texto(item.origem) ||
      this.texto(item.fonte) ||
      null;

    const alvoMarca = this.normalizar(hardware.marca);
    const alvoModelo = this.normalizar(hardware.modelo);
    const alvoNome = this.normalizar(hardware.nome);
    const candMarca = this.normalizar(marca);
    const candModelo = this.normalizar(modelo);
    const candNome = this.normalizar(nome);
    const textoCandidato = `${candMarca} ${candModelo} ${candNome}`.trim();

    let score = 0;
    if (alvoMarca && candMarca === alvoMarca) score += 35;
    else if (alvoMarca && textoCandidato.includes(alvoMarca)) score += 18;

    if (alvoModelo && candModelo === alvoModelo) score += 120;
    else if (alvoModelo && textoCandidato.includes(alvoModelo)) score += 95;
    else if (candModelo && alvoModelo.includes(candModelo)) score += 45;

    const tokensModelo = alvoModelo.split(' ').filter((token) => token.length >= 2);
    if (tokensModelo.length) {
      const encontrados = tokensModelo.filter((token) => textoCandidato.includes(token));
      score += Math.round((encontrados.length / tokensModelo.length) * 35);
    }

    const tokensNome = alvoNome.split(' ').filter((token) => token.length >= 3);
    if (tokensNome.length) {
      const encontrados = tokensNome.filter((token) => textoCandidato.includes(token));
      score += Math.round((encontrados.length / tokensNome.length) * 20);
    }

    if (fonte?.toUpperCase() === 'FABRICANTE_OFICIAL') score += 10;
    if (imagemUrl) score += 5;

    return {
      nome,
      marca,
      modelo,
      imagemUrl,
      urlOrigem,
      fonte,
      score,
      bruto: item,
    };
  }

  private async chamarProdutoIa(
    caminho: string,
    body: Registro,
    timeoutMs = 60_000,
  ): Promise<Registro> {
    const baseUrl = process.env.PRODUTO_IA_URL?.trim();
    const apiKey = process.env.PRODUTO_IA_API_KEY?.trim();
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException(
        'Produto IA não configurada para buscar imagens.',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const endpoint = `${baseUrl.replace(/\/+$/, '')}${caminho}`;
      const resposta = await postProdutoIa(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const textoResposta = await resposta.text();
      if (!resposta.ok) {
        throw new BadGatewayException(
          `Produto IA não conseguiu buscar a imagem (HTTP ${resposta.status}).`,
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(textoResposta);
      } catch {
        throw new BadGatewayException(
          'Produto IA retornou uma resposta inválida ao buscar imagem.',
        );
      }
      if (!this.ehRegistro(parsed)) {
        throw new BadGatewayException(
          'Produto IA retornou formato inválido ao buscar imagem.',
        );
      }
      return parsed;
    } catch (erro) {
      if (erro instanceof BadGatewayException) throw erro;
      if (erro instanceof Error && erro.name === 'AbortError') {
        throw new BadGatewayException('Tempo esgotado ao buscar imagem do hardware.');
      }
      throw erro;
    } finally {
      clearTimeout(timer);
    }
  }

  private async validarImagemPublica(url: string): Promise<string> {
    try {
      const validacao = await validarUrlPublica(url);
      if (!['http:', 'https:'].includes(validacao.url.protocol)) {
        throw new Error('Protocolo de imagem inválido.');
      }
      return validacao.url.toString();
    } catch {
      throw new BadGatewayException(
        'A imagem encontrada não passou na validação de segurança.',
      );
    }
  }

  private async detalharCandidato(
    categoria: CategoriaHardware,
    candidato: CandidatoImagem,
  ): Promise<{ imagemUrl: string | null; fonte: string | null; urlOrigem: string | null }> {
    if (!candidato.urlOrigem || !candidato.fonte || !candidato.nome) {
      return {
        imagemUrl: candidato.imagemUrl,
        fonte: candidato.fonte,
        urlOrigem: candidato.urlOrigem,
      };
    }

    const resposta = await this.chamarProdutoIa(
      '/descobrir-hardwares/detalhar',
      {
        categoria,
        nome: candidato.nome,
        url: candidato.urlOrigem,
        fonte: candidato.fonte,
        marca: candidato.marca || null,
        enriquecer: false,
        noBrowser: false,
      },
      45_000,
    );
    const item = this.ehRegistro(resposta.item) ? resposta.item : resposta;
    const payload = this.payloadDoItem(item);
    return {
      imagemUrl: this.texto(payload.imagemUrl) || candidato.imagemUrl,
      fonte:
        this.texto(item.fontePrincipal) ||
        this.texto(item.fonteCatalogo) ||
        candidato.fonte,
      urlOrigem:
        this.texto(item.urlFontePrincipal) ||
        this.texto(item.urlOrigem) ||
        candidato.urlOrigem,
    };
  }

  private async buscarImagemEmOfertasIdenticas(hardware: {
    nome: string;
    marca: string;
    modelo: string;
    mpn?: string | null;
    gtin?: string | null;
  }): Promise<ImagemEncontrada | null> {
    const modelo = this.texto(hardware.modelo);
    const mpn = this.texto(hardware.mpn);
    const gtin = this.texto(hardware.gtin);
    if (!modelo && !mpn && !gtin) return null;

    let resposta: Registro;
    try {
      resposta = await this.chamarProdutoIa(
        '/ofertas/produto-identico',
        {
          nome: hardware.nome,
          marca: this.texto(hardware.marca) || null,
          modelo: modelo || null,
          mpn: mpn || null,
          gtin: gtin || null,
          limitePorLoja: 3,
        },
        55_000,
      );
    } catch (erro) {
      if (erro instanceof BadGatewayException) return null;
      throw erro;
    }

    const ofertas = Array.isArray(resposta.ofertas) ? resposta.ofertas : [];
    for (const bruto of ofertas) {
      if (!this.ehRegistro(bruto)) continue;
      const imagemOriginal = this.texto(bruto.imagemUrl);
      if (!imagemOriginal) continue;
      try {
        const imagemUrl = await this.validarImagemPublica(imagemOriginal);
        return {
          imagemUrl,
          fonte:
            this.texto(bruto.fonte) ||
            this.texto(bruto.marketplace) ||
            'OFERTA_PRODUTO_IDENTICO',
          urlOrigem: this.texto(bruto.urlOriginal) || null,
          nome: this.texto(bruto.nomeEncontrado) || hardware.nome,
          marca: hardware.marca,
          modelo: hardware.modelo,
          score: 200,
          criterio: this.texto(bruto.criterioIdentidade) || null,
        };
      } catch (erro) {
        if (erro instanceof BadGatewayException) continue;
        throw erro;
      }
    }
    return null;
  }

  private async salvarImagem(
    hardwareId: number,
    encontrada: ImagemEncontrada,
  ) {
    const atualizado = await this.hardwaresService.atualizar(hardwareId, {
      imagemUrl: encontrada.imagemUrl,
    });
    return {
      status: 'IMAGEM_ATUALIZADA' as const,
      hardwareId,
      imagemUrl: encontrada.imagemUrl,
      fonte: encontrada.fonte,
      urlFonte: encontrada.urlOrigem,
      correspondencia: {
        nome: encontrada.nome,
        marca: encontrada.marca,
        modelo: encontrada.modelo,
        score: encontrada.score,
        criterio: encontrada.criterio ?? null,
      },
      hardware: atualizado,
    };
  }

  async buscarESalvar(hardwareId: number) {
    const hardware = await this.hardwaresService.buscarPorIdAdmin(hardwareId);
    if (!CATEGORIAS_COM_BUSCA_TECNICA.has(hardware.categoria)) {
      throw new BadRequestException(
        `A busca automática de imagem ainda não está disponível para ${hardware.categoria}.`,
      );
    }

    const consulta = [hardware.marca, hardware.modelo, hardware.nome]
      .map((valor) => this.texto(valor))
      .filter(Boolean)
      .join(' ')
      .slice(0, 240);

    const resultado = await this.chamarProdutoIa('/descobrir-hardwares', {
      categoria: hardware.categoria,
      marca: hardware.marca || null,
      consulta,
      pagina: 1,
      limite: 12,
      detalhar: false,
      enriquecer: false,
      noBrowser: false,
    });

    const itens = Array.isArray(resultado.itens) ? resultado.itens : [];
    const candidatos = itens
      .filter((item): item is Registro => this.ehRegistro(item))
      .map((item) => this.pontuar(hardware, item))
      .filter((item) => item.score >= 70)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    for (const candidato of candidatos) {
      try {
        const detalhado = candidato.imagemUrl
          ? {
              imagemUrl: candidato.imagemUrl,
              fonte: candidato.fonte,
              urlOrigem: candidato.urlOrigem,
            }
          : await this.detalharCandidato(hardware.categoria, candidato);
        if (!detalhado.imagemUrl) continue;

        const imagemUrl = await this.validarImagemPublica(detalhado.imagemUrl);
        return this.salvarImagem(hardwareId, {
          imagemUrl,
          fonte: detalhado.fonte,
          urlOrigem: detalhado.urlOrigem,
          nome: candidato.nome,
          marca: candidato.marca,
          modelo: candidato.modelo,
          score: candidato.score,
        });
      } catch (erro) {
        if (erro instanceof BadGatewayException) continue;
        throw erro;
      }
    }

    const imagemOferta = await this.buscarImagemEmOfertasIdenticas(hardware);
    if (imagemOferta) {
      return this.salvarImagem(hardwareId, imagemOferta);
    }

    throw new BadGatewayException(
      candidatos.length
        ? 'Encontrei o hardware, mas as fontes técnicas e as ofertas idênticas não retornaram uma imagem válida.'
        : 'Não encontrei uma correspondência forte com imagem para este hardware.',
    );
  }
}
