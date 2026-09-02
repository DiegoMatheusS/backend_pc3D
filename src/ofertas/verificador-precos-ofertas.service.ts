import { Injectable } from '@nestjs/common';
import { ProdutoIaPythonService } from '../ia/produto-ia-python.service';
import {
  obterCabecalhoHttp,
  requisitarUrlPublicaUmaVez,
  validarUrlPublica,
} from '../common/security/external-http-security';

export type OrigemPrecoVerificado =
  'JSON_LD' | 'META' | 'JSON_EMBUTIDO' | 'HTML_MARKETPLACE';

type ResultadoConsultaPreco =
  | {
      status: 'SUCESSO';
      preco: number;
      urlFinal: string;
      origemPreco: 'JSON_LD' | 'META';
    }
  | {
      status: 'INDISPONIVEL';
      urlFinal: string;
      motivo: string;
    }
  | {
      status: 'BLOQUEADO';
      motivo: string;
      urlFinal?: string;
    }
  | {
      status: 'FALHOU';
      motivo: string;
      urlFinal?: string;
    };

export type ResultadoConfirmacaoProdutoIa =
  | {
      status: 'SUCESSO';
      preco: number;
      precoAnterior: number | null;
      fontePreco: string | null;
      disponivel: boolean | null;
      urlFinal: string | null;
      codigoMarketplace: string | null;
      identidade: {
        mpn: string | null;
        gtin: string | null;
        marca: string | null;
        modelo: string | null;
      };
    }
  | { status: 'BLOQUEADO'; motivo: string }
  | { status: 'ERRO'; motivo: string };

export type ResultadoVerificacaoOferta = ResultadoConsultaPreco & {
  urlConsultada?: 'ORIGINAL' | 'AFILIADA';
};

type PrecoExtraido = {
  preco: number | null;
  origem: OrigemPrecoVerificado | null;
  indisponivel: boolean;
};

type CandidatoPrecoJson = {
  preco: number;
  pontos: number;
  caminho: string;
};

@Injectable()
export class VerificadorPrecosOfertasService {
  constructor(private readonly produtoIa: ProdutoIaPythonService) {}

  // Marketplaces atuais costumam entregar HTML/estado de hidratação acima de 2 MB.
  // O limite continua finito para evitar consumo ilimitado de memória.
  private readonly limiteHtmlBytes = 5_000_000;
  private readonly maximoRedirecionamentos = 4;

  private ehRegistro(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  }

  private normalizarPreco(valor: unknown): number | null {
    if (typeof valor === 'number') {
      return Number.isFinite(valor) && valor > 0
        ? Number(valor.toFixed(2))
        : null;
    }
    if (typeof valor !== 'string') return null;

    let texto = valor
      .replace(/\u00a0/g, ' ')
      .replace(/R\$/gi, '')
      .replace(/[^0-9.,]/g, '')
      .trim();
    if (!texto) return null;

    const ultimaVirgula = texto.lastIndexOf(',');
    const ultimoPonto = texto.lastIndexOf('.');

    if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
      const decimal = ultimaVirgula > ultimoPonto ? ',' : '.';
      const milhar = decimal === ',' ? '.' : ',';
      texto = texto.split(milhar).join('');
      if (decimal === ',') texto = texto.replace(',', '.');
    } else if (ultimaVirgula >= 0) {
      const casas = texto.length - ultimaVirgula - 1;
      texto =
        casas >= 1 && casas <= 2
          ? texto.replace(',', '.')
          : texto.replace(/,/g, '');
    } else if (ultimoPonto >= 0) {
      const casas = texto.length - ultimoPonto - 1;
      if (!(casas >= 1 && casas <= 2)) texto = texto.replace(/\./g, '');
    }

    const numero = Number(texto);
    return Number.isFinite(numero) && numero > 0
      ? Number(numero.toFixed(2))
      : null;
  }

  private normalizarPrecoJson(valor: unknown, hostname: string): number | null {
    if (
      hostname.includes('shopee.') &&
      typeof valor === 'number' &&
      Number.isInteger(valor) &&
      valor >= 1_000_000
    ) {
      // A Shopee frequentemente serializa preço em unidades de 1/100000.
      const convertido = valor / 100_000;
      if (convertido > 0 && convertido < 10_000_000) {
        return Number(convertido.toFixed(2));
      }
    }

    if (
      hostname.includes('shopee.') &&
      typeof valor === 'string' &&
      /^\d{7,15}$/u.test(valor.trim())
    ) {
      const convertido = Number(valor) / 100_000;
      if (
        Number.isFinite(convertido) &&
        convertido > 0 &&
        convertido < 10_000_000
      ) {
        return Number(convertido.toFixed(2));
      }
    }

    return this.normalizarPreco(valor);
  }

  private tipoJsonLd(valor: unknown): string[] {
    if (typeof valor === 'string') return [valor.toLowerCase()];
    if (Array.isArray(valor)) {
      return valor
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.toLowerCase());
    }
    return [];
  }

  private buscarPrecoEmJsonLd(valor: unknown, profundidade = 0): number | null {
    if (profundidade > 10 || valor === null || valor === undefined) return null;
    if (Array.isArray(valor)) {
      for (const item of valor) {
        const encontrado = this.buscarPrecoEmJsonLd(item, profundidade + 1);
        if (encontrado !== null) return encontrado;
      }
      return null;
    }
    if (!this.ehRegistro(valor)) return null;

    const tipos = this.tipoJsonLd(valor['@type']);
    const ehOferta = tipos.some((tipo) => tipo.endsWith('offer'));
    const ehProduto = tipos.some((tipo) => tipo.endsWith('product'));

    if (ehOferta) {
      const preco = this.normalizarPreco(valor.price);
      if (preco !== null) return preco;
      const baixo = this.normalizarPreco(valor.lowPrice);
      if (baixo !== null) return baixo;
      if (this.ehRegistro(valor.priceSpecification)) {
        const especificado = this.normalizarPreco(
          valor.priceSpecification.price,
        );
        if (especificado !== null) return especificado;
      }
    }

    if (ehProduto && valor.offers !== undefined) {
      const precoOferta = this.buscarPrecoEmJsonLd(
        valor.offers,
        profundidade + 1,
      );
      if (precoOferta !== null) return precoOferta;
    }

    for (const [chave, filho] of Object.entries(valor)) {
      if (!['@graph', 'mainEntity', 'itemListElement'].includes(chave))
        continue;
      const encontrado = this.buscarPrecoEmJsonLd(filho, profundidade + 1);
      if (encontrado !== null) return encontrado;
    }

    return null;
  }

  private jsonLdIndicaIndisponivel(valor: unknown, profundidade = 0): boolean {
    if (profundidade > 10 || valor === null || valor === undefined)
      return false;
    if (Array.isArray(valor)) {
      return valor.some((item) =>
        this.jsonLdIndicaIndisponivel(item, profundidade + 1),
      );
    }
    if (!this.ehRegistro(valor)) return false;

    const disponibilidade =
      typeof valor.availability === 'string'
        ? valor.availability.toLowerCase()
        : '';
    if (
      disponibilidade.endsWith('/outofstock') ||
      disponibilidade.endsWith('/discontinued') ||
      disponibilidade === 'outofstock' ||
      disponibilidade === 'discontinued'
    ) {
      return true;
    }

    return Object.entries(valor).some(([chave, filho]) =>
      ['offers', '@graph', 'mainEntity', 'itemListElement'].includes(chave)
        ? this.jsonLdIndicaIndisponivel(filho, profundidade + 1)
        : false,
    );
  }

  private extrairJsonLd(html: string): unknown[] {
    const resultados: unknown[] = [];
    const regex =
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const match of html.matchAll(regex)) {
      const bruto = match[1]?.trim();
      if (!bruto || bruto.length > 1_000_000) continue;
      try {
        resultados.push(JSON.parse(bruto) as unknown);
      } catch {
        // JSON-LD malformado é ignorado; não inferimos preço por texto solto.
      }
    }
    return resultados;
  }

  private extrairPrecoMeta(html: string): number | null {
    const padroes = [
      /<meta\b[^>]*(?:property|name)=["']product:price:amount["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']product:price:amount["'][^>]*>/i,
      /<meta\b[^>]*(?:property|name)=["']og:price:amount["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:price:amount["'][^>]*>/i,
      /<meta\b[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta\b[^>]*content=["']([^"']+)["'][^>]*itemprop=["']price["'][^>]*>/i,
      /<(?:span|div)\b[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<(?:span|div)\b[^>]*content=["']([^"']+)["'][^>]*itemprop=["']price["'][^>]*>/i,
      /<(?:div|span)\b[^>]*data-(?:product-)?price=["']([^"']+)["'][^>]*>/i,
    ];

    for (const padrao of padroes) {
      const preco = this.normalizarPreco(padrao.exec(html)?.[1]);
      if (preco !== null) return preco;
    }
    return null;
  }

  private extrairScriptsJson(html: string): unknown[] {
    const resultados: unknown[] = [];
    const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(regex)) {
      const atributos = match[1] ?? '';
      const corpo = match[2]?.trim() ?? '';
      if (!corpo || corpo.length > 3_500_000) continue;

      const ehJson =
        /type=["']application\/(?:json|ld\+json)["']/i.test(atributos) ||
        /id=["'](?:__NEXT_DATA__|__NUXT_DATA__|__APOLLO_STATE__)["']/i.test(
          atributos,
        );
      if (!ehJson || (!corpo.startsWith('{') && !corpo.startsWith('['))) {
        continue;
      }

      try {
        resultados.push(JSON.parse(corpo) as unknown);
      } catch {
        // Estados de hidratação incompletos/malformados são ignorados.
      }
    }

    return resultados;
  }

  private chavePrecoPontuacao(chave: string, caminhoPai: string): number {
    const normalizada = chave.toLowerCase().replace(/[^a-z0-9]/g, '');
    const caminho = caminhoPai.toLowerCase().replace(/[^a-z0-9]/g, '');
    const composto = `${caminho}${normalizada}`;

    if (
      /(installment|parcel|freight|shipping|delivery|coupon|cupom|saving|discountpercent|percentage|tax|fee)/u.test(
        composto,
      )
    ) {
      return -100;
    }

    if (
      /(pricebefore|beforeprice|oldprice|originalprice|listprice|regularprice|previousprice|compareat|pricefrom)/u.test(
        composto,
      )
    ) {
      return -80;
    }

    if (/^(pixprice|pricepix|cashprice|bestprice)$/u.test(normalizada))
      return 150;
    if (
      /^(finalprice|currentprice|saleprice|sellingprice|promotionalprice|discountedprice|offerprice)$/u.test(
        normalizada,
      )
    ) {
      return 135;
    }
    if (/^(priceto|pricevalue|unitprice)$/u.test(normalizada)) return 115;
    if (/^(price|minprice|pricemin|price_min)$/u.test(normalizada)) return 95;

    if (
      /^(amount|value)$/u.test(normalizada) &&
      /(price|offer|sale|selling|pix|cash|current|final)/u.test(caminho)
    ) {
      return 105;
    }

    return -20;
  }

  private buscarCandidatosPrecoJson(
    valor: unknown,
    hostname: string,
    caminho: string[] = [],
    profundidade = 0,
    resultados: CandidatoPrecoJson[] = [],
  ): CandidatoPrecoJson[] {
    if (profundidade > 14 || resultados.length > 300) return resultados;

    if (Array.isArray(valor)) {
      for (let indice = 0; indice < Math.min(valor.length, 80); indice++) {
        this.buscarCandidatosPrecoJson(
          valor[indice],
          hostname,
          [...caminho, String(indice)],
          profundidade + 1,
          resultados,
        );
      }
      return resultados;
    }

    if (!this.ehRegistro(valor)) return resultados;

    for (const [chave, filho] of Object.entries(valor)) {
      const caminhoPai = caminho.join('.');
      const pontos = this.chavePrecoPontuacao(chave, caminhoPai);

      if (
        pontos > 0 &&
        (typeof filho === 'number' || typeof filho === 'string')
      ) {
        const preco = this.normalizarPrecoJson(filho, hostname);
        if (preco !== null && preco >= 0.5 && preco < 10_000_000) {
          resultados.push({
            preco,
            pontos,
            caminho: [...caminho, chave].join('.'),
          });
        }
      }

      if (typeof filho === 'object' && filho !== null) {
        this.buscarCandidatosPrecoJson(
          filho,
          hostname,
          [...caminho, chave],
          profundidade + 1,
          resultados,
        );
      }
    }

    return resultados;
  }

  private extrairPrecoJsonEmbutido(
    html: string,
    hostname: string,
  ): number | null {
    const estados = this.extrairScriptsJson(html);
    const candidatos: CandidatoPrecoJson[] = [];

    for (const estado of estados) {
      this.buscarCandidatosPrecoJson(estado, hostname, [], 0, candidatos);
    }

    const confiaveis = candidatos
      .filter((candidato) => candidato.pontos >= 95)
      .sort(
        (a, b) => b.pontos - a.pontos || a.caminho.length - b.caminho.length,
      );

    return confiaveis[0]?.preco ?? null;
  }

  private decodificarEntidadesBasicas(texto: string): string {
    return texto
      .replace(/&nbsp;|&#160;|&#x0*a0;/gi, ' ')
      .replace(/&quot;|&#34;|&#x0*22;/gi, '"')
      .replace(/&apos;|&#39;|&#x0*27;/gi, "'")
      .replace(/&amp;|&#38;|&#x0*26;/gi, '&')
      .replace(/&lt;|&#60;|&#x0*3c;/gi, '<')
      .replace(/&gt;|&#62;|&#x0*3e;/gi, '>');
  }

  private textoVisivel(html: string): string {
    return this.decodificarEntidadesBasicas(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    )
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extrairPrecoAntesDoRotulo(
    texto: string,
    rotulo: RegExp,
    distanciaMaxima: number,
  ): number | null {
    const ocorrenciasRotulo = Array.from(texto.matchAll(rotulo));
    const precos = Array.from(
      texto.matchAll(
        /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})|[0-9]+(?:[.,][0-9]{1,2})?)/gi,
      ),
    );

    for (const alvo of ocorrenciasRotulo) {
      const posicaoRotulo = alvo.index ?? -1;
      if (posicaoRotulo < 0) continue;

      const anteriores = precos
        .filter((preco) => {
          const posicao = preco.index ?? -1;
          return (
            posicao >= 0 &&
            posicao < posicaoRotulo &&
            posicaoRotulo - posicao <= distanciaMaxima
          );
        })
        .sort((a, b) => (b.index ?? 0) - (a.index ?? 0));

      const valor = this.normalizarPreco(anteriores[0]?.[1]);
      if (valor !== null) return valor;
    }

    return null;
  }

  private extrairPrecoMercadoLivre(html: string): number | null {
    const regioes = Array.from(
      html.matchAll(
        /<(?:div|section)\b[^>]*class=["'][^"']*(?:ui-pdp-price__second-line|ui-pdp-price__main-container)[^"']*["'][^>]*>([\s\S]{0,12_000}?)(?:<\/(?:div|section)>)/gi,
      ),
    );

    const alvos =
      regioes.length > 0 ? regioes.map((item) => item[1] ?? '') : [html];
    for (const alvo of alvos) {
      const fracao =
        /class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>\s*([0-9.]+)\s*</i.exec(
          alvo,
        )?.[1];
      if (!fracao) continue;

      const centavos =
        /class=["'][^"']*andes-money-amount__cents[^"']*["'][^>]*>\s*([0-9]{1,2})\s*</i.exec(
          alvo,
        )?.[1];
      const preco = this.normalizarPreco(
        centavos ? `${fracao},${centavos.padEnd(2, '0')}` : fracao,
      );
      if (preco !== null) return preco;
    }

    return null;
  }

  private extrairPrecoMagalu(html: string): number | null {
    const texto = this.textoVisivel(html).slice(0, 120_000);

    const pix = this.extrairPrecoAntesDoRotulo(texto, /\bno\s+pix\b/gi, 120);
    if (pix !== null) return pix;

    const padroes = [
      /(?:preço|por)\s*R\$\s*([0-9.]+(?:,[0-9]{1,2})?)/i,
      /R\$\s*([0-9.]+(?:,[0-9]{1,2})?)\s*(?:à vista|a vista)/i,
    ];
    for (const padrao of padroes) {
      const preco = this.normalizarPreco(padrao.exec(texto)?.[1]);
      if (preco !== null) return preco;
    }

    return null;
  }

  private extrairPrecoShopee(html: string): number | null {
    const texto = this.textoVisivel(html).slice(0, 80_000);
    const ocorrencias = Array.from(
      texto.matchAll(/R\$\s*([0-9.]+(?:,[0-9]{1,2})?)/gi),
    );

    for (const ocorrencia of ocorrencias.slice(0, 12)) {
      const posicao = ocorrencia.index ?? 0;
      const contextoAntes = texto
        .slice(Math.max(0, posicao - 55), posicao)
        .toLowerCase();
      const contextoDepois = texto.slice(posicao, posicao + 35).toLowerCase();
      if (
        /frete|cupom|parcela|cashback/u.test(contextoAntes) ||
        /\bx\s+de\b|parcela/u.test(contextoDepois)
      ) {
        continue;
      }

      const preco = this.normalizarPreco(ocorrencia[1]);
      if (preco !== null) return preco;
    }

    return null;
  }

  private extrairPrecoMarketplace(
    html: string,
    hostname: string,
  ): number | null {
    const host = hostname.toLowerCase();

    if (host.includes('mercadolivre.') || host.includes('mercadolibre.')) {
      return this.extrairPrecoMercadoLivre(html);
    }
    if (host.includes('magazineluiza.')) {
      return this.extrairPrecoMagalu(html);
    }
    if (host.includes('shopee.')) {
      return this.extrairPrecoShopee(html);
    }

    return null;
  }

  private extrairPrecoEstruturado(html: string, url?: URL): PrecoExtraido {
    const jsonLd = this.extrairJsonLd(html);
    for (const item of jsonLd) {
      const preco = this.buscarPrecoEmJsonLd(item);
      if (preco !== null) {
        return { preco, origem: 'JSON_LD', indisponivel: false };
      }
    }

    const indisponivel = jsonLd.some((item) =>
      this.jsonLdIndicaIndisponivel(item),
    );
    if (indisponivel) {
      return { preco: null, origem: null, indisponivel: true };
    }

    const precoMeta = this.extrairPrecoMeta(html);
    if (precoMeta !== null) {
      return { preco: precoMeta, origem: 'META', indisponivel: false };
    }

    const hostname = url?.hostname.toLowerCase() ?? '';
    const precoJson = this.extrairPrecoJsonEmbutido(html, hostname);
    if (precoJson !== null) {
      return {
        preco: precoJson,
        origem: 'JSON_EMBUTIDO',
        indisponivel: false,
      };
    }

    const precoMarketplace = this.extrairPrecoMarketplace(html, hostname);
    if (precoMarketplace !== null) {
      return {
        preco: precoMarketplace,
        origem: 'HTML_MARKETPLACE',
        indisponivel: false,
      };
    }

    return { preco: null, origem: null, indisponivel: false };
  }

  private paginaPareceBloqueio(html: string): boolean {
    const inicio = this.textoVisivel(html).slice(0, 12_000).toLowerCase();
    return [
      'access denied',
      'captcha',
      'verifique que você é humano',
      'verifique que voce e humano',
      'robot or human',
      'unusual traffic',
      'az-request-verify',
      'acessou nosso site de uma forma um pouco diferente do comum',
      'para sua segurança precisamos de uma verificação rápida',
    ].some((trecho) => inicio.includes(trecho));
  }

  private async consultarUrl(valor: string): Promise<ResultadoConsultaPreco> {
    let atual: URL;
    try {
      atual = (await validarUrlPublica(valor)).url;
    } catch (erro) {
      return {
        status: 'FALHOU',
        motivo: erro instanceof Error ? erro.message : 'URL inválida.',
      };
    }

    for (
      let redirecionamentos = 0;
      redirecionamentos <= this.maximoRedirecionamentos;
      redirecionamentos++
    ) {
      let resposta: Awaited<ReturnType<typeof requisitarUrlPublicaUmaVez>>;
      try {
        resposta = await requisitarUrlPublicaUmaVez(atual, {
          timeoutMs: 15_000,
          limiteRespostaBytes: this.limiteHtmlBytes,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
            'Upgrade-Insecure-Requests': '1',
          },
        });
      } catch (erro) {
        return {
          status: 'FALHOU',
          motivo:
            erro instanceof Error
              ? erro.message
              : 'Falha de rede ao consultar a página.',
        };
      }

      if (resposta.status >= 300 && resposta.status < 400) {
        const local = obterCabecalhoHttp(resposta, 'location');
        if (!local) {
          return {
            status: 'FALHOU',
            motivo: 'Redirecionamento sem destino.',
          };
        }
        if (redirecionamentos >= this.maximoRedirecionamentos) {
          return {
            status: 'FALHOU',
            motivo: 'Excesso de redirecionamentos.',
          };
        }
        try {
          atual = (await validarUrlPublica(new URL(local, atual))).url;
        } catch (erro) {
          return {
            status: 'FALHOU',
            motivo:
              erro instanceof Error
                ? erro.message
                : 'Destino de redirecionamento inválido.',
          };
        }
        continue;
      }

      if (resposta.status === 404 || resposta.status === 410) {
        return {
          status: 'INDISPONIVEL',
          urlFinal: atual.toString(),
          motivo: `A página retornou HTTP ${resposta.status}.`,
        };
      }

      if (!resposta.ok) {
        if (resposta.status === 403 || resposta.status === 429) {
          return {
            status: 'BLOQUEADO',
            urlFinal: atual.toString(),
            motivo: `O marketplace bloqueou a consulta automática (HTTP ${resposta.status}).`,
          };
        }
        return {
          status: 'FALHOU',
          urlFinal: atual.toString(),
          motivo: `A página retornou HTTP ${resposta.status}.`,
        };
      }

      const contentType = obterCabecalhoHttp(resposta, 'content-type') ?? '';
      if (!contentType.toLowerCase().includes('text/html')) {
        return {
          status: 'FALHOU',
          motivo: 'A URL não retornou HTML.',
        };
      }

      const html = resposta.corpo.toString('utf8');
      if (this.paginaPareceBloqueio(html)) {
        return {
          status: 'BLOQUEADO',
          urlFinal: atual.toString(),
          motivo:
            'O marketplace bloqueou a consulta automática desta página. O valor salvo não foi alterado.',
        };
      }

      const extraido = this.extrairPrecoEstruturado(html, atual);
      if (extraido.indisponivel) {
        return {
          status: 'INDISPONIVEL',
          urlFinal: atual.toString(),
          motivo: 'Os dados estruturados indicam item indisponível.',
        };
      }
      if (extraido.preco !== null && extraido.origem !== null) {
        return {
          status: 'SUCESSO',
          preco: extraido.preco,
          urlFinal: atual.toString(),
          // Mantém o contrato legado da API. Métodos novos de extração são
          // reportados como META para não quebrar consumidores existentes.
          origemPreco: extraido.origem === 'JSON_LD' ? 'JSON_LD' : 'META',
        };
      }

      return {
        status: 'FALHOU',
        motivo:
          'Não foi encontrado preço confiável na página. O valor salvo não foi alterado.',
      };
    }

    return { status: 'FALHOU', motivo: 'Não foi possível verificar a URL.' };
  }

  async confirmarComProdutoIa(
    url: string,
  ): Promise<ResultadoConfirmacaoProdutoIa> {
    try {
      const resultado = await this.produtoIa.importarUrl(url, undefined, {
        enrich: false,
        criabytePlan: false,
        noBrowser: false,
      });
      const oferta = this.ehRegistro(resultado.ofertaColetada)
        ? resultado.ofertaColetada
        : {};
      const payload = this.ehRegistro(resultado.cadastroSugerido?.payload)
        ? (resultado.cadastroSugerido?.payload ?? {})
        : this.ehRegistro(resultado.payloadParcialBackend)
          ? resultado.payloadParcialBackend
          : {};
      const fonte =
        typeof resultado.fonte === 'string'
          ? resultado.fonte.toUpperCase()
          : '';
      const erro =
        typeof resultado.erro === 'string' ? resultado.erro.trim() : '';
      const bloqueado =
        (Boolean(erro) && /BLOQUE|CAPTCHA|ANTI.?BOT|403|429/iu.test(erro)) ||
        fonte.includes('BLOQUEADO') ||
        (this.ehRegistro(resultado.marketplace) &&
          resultado.marketplace.bloqueadoNoNavegador === true);

      if (bloqueado) {
        return {
          status: 'BLOQUEADO',
          motivo: erro || 'A Produto IA identificou bloqueio do marketplace.',
        };
      }
      if (erro) return { status: 'ERRO', motivo: erro };

      const preco = this.normalizarPreco(oferta.preco);
      if (preco === null) {
        return {
          status: 'ERRO',
          motivo: 'A Produto IA não retornou preço confiável para esta oferta.',
        };
      }

      return {
        status: 'SUCESSO',
        preco,
        precoAnterior: this.normalizarPreco(oferta.precoAnterior),
        fontePreco:
          typeof oferta.fontePreco === 'string' ? oferta.fontePreco : null,
        disponivel:
          typeof oferta.disponivel === 'boolean' ? oferta.disponivel : null,
        urlFinal:
          typeof oferta.urlProduto === 'string'
            ? oferta.urlProduto
            : typeof oferta.urlOriginal === 'string'
              ? oferta.urlOriginal
              : null,
        codigoMarketplace:
          typeof oferta.codigoMarketplace === 'string'
            ? oferta.codigoMarketplace
            : null,
        identidade: {
          mpn:
            typeof payload.mpn === 'string' ? payload.mpn.trim() || null : null,
          gtin:
            typeof payload.gtin === 'string'
              ? payload.gtin.trim() || null
              : null,
          marca:
            typeof payload.marca === 'string'
              ? payload.marca.trim() || null
              : null,
          modelo:
            typeof payload.modelo === 'string'
              ? payload.modelo.trim() || null
              : null,
        },
      };
    } catch (erro) {
      return {
        status: 'ERRO',
        motivo:
          erro instanceof Error
            ? erro.message
            : 'Falha ao consultar a Produto IA.',
      };
    }
  }

  async verificarOferta(dados: {
    urlOriginal: string;
    urlAfiliada: string | null;
  }): Promise<ResultadoVerificacaoOferta> {
    const original = await this.consultarUrl(dados.urlOriginal);
    if (original.status === 'SUCESSO') {
      return { ...original, urlConsultada: 'ORIGINAL' };
    }

    if (dados.urlAfiliada && dados.urlAfiliada !== dados.urlOriginal) {
      const afiliada = await this.consultarUrl(dados.urlAfiliada);
      if (afiliada.status === 'SUCESSO') {
        return { ...afiliada, urlConsultada: 'AFILIADA' };
      }
      if (
        original.status === 'INDISPONIVEL' &&
        afiliada.status === 'INDISPONIVEL'
      ) {
        return { ...original, urlConsultada: 'ORIGINAL' };
      }
      if (original.status === 'BLOQUEADO' || afiliada.status === 'BLOQUEADO') {
        return {
          status: 'BLOQUEADO',
          motivo: `URL original: ${original.motivo} URL afiliada: ${afiliada.motivo}`,
        };
      }
      return {
        status: 'FALHOU',
        motivo: `URL original: ${original.motivo} URL afiliada: ${afiliada.motivo}`,
      };
    }

    return { ...original, urlConsultada: 'ORIGINAL' };
  }
}
