import { Injectable } from '@nestjs/common';
import {
  obterCabecalhoHttp,
  requisitarUrlPublicaUmaVez,
  validarUrlPublica,
} from '../common/security/external-http-security';

type Registro = Record<string, unknown>;

export type HardwareBuscaImagemGoogle = {
  nome: string;
  marca: string;
  modelo: string;
  mpn?: string | null;
  gtin?: string | null;
};

export type ImagemGoogleEncontrada = {
  imagemUrl: string;
  fonte: 'GOOGLE_IMAGENS';
  provedor: 'SERPAPI' | 'GOOGLE_CUSTOM_SEARCH';
  urlOrigem: string | null;
  nome: string;
  marca: string;
  modelo: string;
  score: number;
  criterio: string;
};

type CandidatoGoogle = {
  imagemUrl: string;
  urlOrigem: string | null;
  titulo: string;
  score: number;
  criterio: string;
};

@Injectable()
export class GoogleImageSearchService {
  private readonly concorrenciaMaxima = 10;
  private concorrenciaAtual = 10;
  private ativas = 0;
  private fila: Array<() => void> = [];
  private concorrenciaReduzidaAte = 0;

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

  private ehRegistro(valor: unknown): valor is Registro {
    return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
  }

  configurado(): boolean {
    const serpApi = process.env.SERPAPI_API_KEY?.trim();
    const googleApi = process.env.GOOGLE_IMAGE_SEARCH_API_KEY?.trim();
    const googleCx = process.env.GOOGLE_IMAGE_SEARCH_CX?.trim();
    return Boolean(serpApi || (googleApi && googleCx));
  }

  private timeoutMs(): number {
    const configurado = Number(process.env.GOOGLE_IMAGE_SEARCH_TIMEOUT_MS);
    if (!Number.isFinite(configurado)) return 10_000;
    return Math.min(Math.max(Math.trunc(configurado), 2_000), 20_000);
  }

  private restaurarConcorrenciaSeNecessario(): void {
    if (
      this.concorrenciaAtual < this.concorrenciaMaxima &&
      Date.now() >= this.concorrenciaReduzidaAte
    ) {
      this.concorrenciaAtual = this.concorrenciaMaxima;
    }
  }

  private reduzirConcorrenciaTemporariamente(): void {
    this.concorrenciaAtual = Math.max(
      2,
      Math.floor(this.concorrenciaAtual / 2),
    );
    this.concorrenciaReduzidaAte = Date.now() + 60_000;
  }

  private drenarFila(): void {
    this.restaurarConcorrenciaSeNecessario();
    while (this.ativas < this.concorrenciaAtual && this.fila.length) {
      const proxima = this.fila.shift();
      if (!proxima) break;
      this.ativas += 1;
      proxima();
    }
  }

  private adquirirVaga(): Promise<void> {
    this.restaurarConcorrenciaSeNecessario();
    if (this.ativas < this.concorrenciaAtual) {
      this.ativas += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.fila.push(resolve);
    });
  }

  private liberarVaga(): void {
    this.ativas = Math.max(0, this.ativas - 1);
    this.drenarFila();
  }

  private async aguardar(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private tokensRelevantes(valor: string, minimo = 2): string[] {
    return this.normalizar(valor)
      .split(' ')
      .filter((token) => token.length >= minimo);
  }

  private proporcaoTokens(tokens: string[], texto: string): number {
    if (!tokens.length) return 0;
    const encontrados = tokens.filter((token) => texto.includes(token)).length;
    return encontrados / tokens.length;
  }

  private pontuar(
    hardware: HardwareBuscaImagemGoogle,
    item: Registro,
  ): CandidatoGoogle | null {
    const imagemUrl = this.texto(item.link);
    if (!imagemUrl) return null;

    const imagem = this.ehRegistro(item.image) ? item.image : {};
    const urlOrigem = this.texto(imagem.contextLink) || null;
    const titulo = this.texto(item.title);
    const snippet = this.texto(item.snippet);
    const displayLink = this.texto(item.displayLink);
    const contexto = this.normalizar(
      [titulo, snippet, displayLink, urlOrigem].filter(Boolean).join(' '),
    );

    const marca = this.normalizar(hardware.marca);
    const modelo = this.normalizar(hardware.modelo);
    const mpn = this.normalizar(hardware.mpn);
    const gtin = this.normalizar(hardware.gtin);
    const tokensModelo = this.tokensRelevantes(hardware.modelo);
    const tokensNome = this.tokensRelevantes(hardware.nome, 3);
    const proporcaoModelo = this.proporcaoTokens(tokensModelo, contexto);
    const proporcaoNome = this.proporcaoTokens(tokensNome, contexto);

    let score = 0;
    const criterios: string[] = [];

    if (gtin && contexto.includes(gtin)) {
      score += 180;
      criterios.push('GTIN');
    }
    if (mpn && contexto.includes(mpn)) {
      score += 150;
      criterios.push('MPN');
    }
    if (modelo && contexto.includes(modelo)) {
      score += 120;
      criterios.push('MODELO_EXATO');
    } else if (tokensModelo.length) {
      score += Math.round(proporcaoModelo * 90);
      if (proporcaoModelo >= 0.8) criterios.push('TOKENS_MODELO');
    }
    if (marca && contexto.includes(marca)) {
      score += 35;
      criterios.push('MARCA');
    }
    score += Math.round(proporcaoNome * 20);

    const identidadeForte =
      criterios.includes('GTIN') ||
      criterios.includes('MPN') ||
      criterios.includes('MODELO_EXATO') ||
      (criterios.includes('TOKENS_MODELO') &&
        (!marca || criterios.includes('MARCA')));

    if (!identidadeForte || score < 100) return null;

    return {
      imagemUrl,
      urlOrigem,
      titulo,
      score,
      criterio: criterios.join('+'),
    };
  }

  private consulta(hardware: HardwareBuscaImagemGoogle): string {
    const partes = [
      this.texto(hardware.marca),
      this.texto(hardware.modelo),
      this.texto(hardware.mpn),
      this.texto(hardware.gtin),
      this.texto(hardware.nome),
    ].filter(Boolean);

    return [...new Set(partes)].join(' ').slice(0, 220);
  }

  private async requisitarComRetry(url: URL) {
    const tentativas = 2;
    for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
      try {
        const resposta = await requisitarUrlPublicaUmaVez(url, {
          timeoutMs: this.timeoutMs(),
          limiteRespostaBytes: 1_500_000,
          headers: { Accept: 'application/json' },
        });

        if (resposta.status === 429) {
          this.reduzirConcorrenciaTemporariamente();
          if (tentativa < tentativas) {
            const retryAfter = Number(obterCabecalhoHttp(resposta, 'retry-after'));
            const espera = Number.isFinite(retryAfter)
              ? Math.min(Math.max(retryAfter * 1000, 500), 3_000)
              : 1_000;
            await this.aguardar(espera);
            continue;
          }
        }

        if (resposta.status >= 500 && tentativa < tentativas) {
          await this.aguardar(500);
          continue;
        }

        return resposta;
      } catch {
        if (tentativa >= tentativas) return null;
        await this.aguardar(500);
      }
    }
    return null;
  }

  private normalizarItemSerpApi(item: Registro): Registro {
    return {
      title: this.texto(item.title),
      snippet: [
        this.texto(item.source),
        this.texto(item.title),
        this.texto(item.snippet),
      ]
        .filter(Boolean)
        .join(' '),
      displayLink: this.texto(item.source),
      link: this.texto(item.original),
      image: {
        contextLink: this.texto(item.link),
      },
    };
  }

  private async buscarViaSerpApi(
    hardware: HardwareBuscaImagemGoogle,
  ): Promise<CandidatoGoogle[]> {
    const apiKey = process.env.SERPAPI_API_KEY?.trim();
    if (!apiKey) return [];

    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('engine', 'google_images');
    url.searchParams.set('q', this.consulta(hardware));
    url.searchParams.set('hl', 'pt-BR');
    url.searchParams.set('gl', 'br');
    url.searchParams.set('safe', 'active');
    url.searchParams.set('ijn', '0');

    const resposta = await this.requisitarComRetry(url);
    if (!resposta?.ok) return [];

    let payload: unknown;
    try {
      payload = JSON.parse(resposta.corpo.toString('utf8'));
    } catch {
      return [];
    }
    if (!this.ehRegistro(payload) || !Array.isArray(payload.images_results)) {
      return [];
    }

    return payload.images_results
      .slice(0, 10)
      .filter((item): item is Registro => this.ehRegistro(item))
      .map((item) => this.normalizarItemSerpApi(item))
      .map((item) => this.pontuar(hardware, item))
      .filter((item): item is CandidatoGoogle => Boolean(item))
      .sort((a, b) => b.score - a.score);
  }

  private async buscarViaGoogleCustomSearch(
    hardware: HardwareBuscaImagemGoogle,
  ): Promise<CandidatoGoogle[]> {
    const apiKey = process.env.GOOGLE_IMAGE_SEARCH_API_KEY?.trim();
    const cx = process.env.GOOGLE_IMAGE_SEARCH_CX?.trim();
    if (!apiKey || !cx) return [];

    const url = new URL('https://customsearch.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', this.consulta(hardware));
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', '10');
    url.searchParams.set('safe', 'active');
    url.searchParams.set('filter', '1');
    url.searchParams.set('imgType', 'photo');
    url.searchParams.set('gl', 'br');
    url.searchParams.set('hl', 'pt-BR');

    const resposta = await this.requisitarComRetry(url);
    if (!resposta?.ok) return [];

    let payload: unknown;
    try {
      payload = JSON.parse(resposta.corpo.toString('utf8'));
    } catch {
      return [];
    }
    if (!this.ehRegistro(payload) || !Array.isArray(payload.items)) return [];

    return payload.items
      .filter((item): item is Registro => this.ehRegistro(item))
      .map((item) => this.pontuar(hardware, item))
      .filter((item): item is CandidatoGoogle => Boolean(item))
      .sort((a, b) => b.score - a.score);
  }

  private async validarCandidatos(
    hardware: HardwareBuscaImagemGoogle,
    provedor: ImagemGoogleEncontrada['provedor'],
    candidatos: CandidatoGoogle[],
  ): Promise<ImagemGoogleEncontrada | null> {
    for (const candidato of candidatos) {
      try {
        const validada = await validarUrlPublica(candidato.imagemUrl);
        return {
          imagemUrl: validada.url.toString(),
          fonte: 'GOOGLE_IMAGENS',
          provedor,
          urlOrigem: candidato.urlOrigem,
          nome: candidato.titulo || hardware.nome,
          marca: hardware.marca,
          modelo: hardware.modelo,
          score: candidato.score,
          criterio: candidato.criterio,
        };
      } catch {
        continue;
      }
    }
    return null;
  }

  async buscar(
    hardware: HardwareBuscaImagemGoogle,
  ): Promise<ImagemGoogleEncontrada | null> {
    if (!this.configurado()) return null;

    await this.adquirirVaga();
    try {
      const serpApi = await this.buscarViaSerpApi(hardware);
      const validadaSerpApi = await this.validarCandidatos(
        hardware,
        'SERPAPI',
        serpApi,
      );
      if (validadaSerpApi) return validadaSerpApi;

      const googleCustomSearch = await this.buscarViaGoogleCustomSearch(hardware);
      return await this.validarCandidatos(
        hardware,
        'GOOGLE_CUSTOM_SEARCH',
        googleCustomSearch,
      );
    } finally {
      this.liberarVaga();
    }
  }
}
