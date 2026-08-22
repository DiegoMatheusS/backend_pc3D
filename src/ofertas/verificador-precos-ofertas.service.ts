import { Injectable } from '@nestjs/common';
import {
  obterCabecalhoHttp,
  requisitarUrlPublicaUmaVez,
  validarUrlPublica,
} from '../common/security/external-http-security';

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
      status: 'FALHOU';
      motivo: string;
    };

export type ResultadoVerificacaoOferta = ResultadoConsultaPreco & {
  urlConsultada?: 'ORIGINAL' | 'AFILIADA';
};

@Injectable()
export class VerificadorPrecosOfertasService {
  private readonly limiteHtmlBytes = 2_000_000;
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
        // JSON-LD malformado é ignorado; não fazemos inferência por texto solto.
      }
    }
    return resultados;
  }

  private extrairPrecoMeta(html: string): number | null {
    const padroes = [
      /<meta\b[^>]*(?:property|name)=["']product:price:amount["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']product:price:amount["'][^>]*>/i,
      /<meta\b[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta\b[^>]*content=["']([^"']+)["'][^>]*itemprop=["']price["'][^>]*>/i,
    ];

    for (const padrao of padroes) {
      const preco = this.normalizarPreco(padrao.exec(html)?.[1]);
      if (preco !== null) return preco;
    }
    return null;
  }

  private extrairPrecoEstruturado(html: string): {
    preco: number | null;
    origem: 'JSON_LD' | 'META' | null;
    indisponivel: boolean;
  } {
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
    return {
      preco: precoMeta,
      origem: precoMeta === null ? null : 'META',
      indisponivel: false,
    };
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
          timeoutMs: 12_000,
          limiteRespostaBytes: this.limiteHtmlBytes,
          headers: {
            'User-Agent': 'CriaByte-OfferVerifier/1.0',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-BR,pt;q=0.9',
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
        return {
          status: 'FALHOU',
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
      const extraido = this.extrairPrecoEstruturado(html);
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
          origemPreco: extraido.origem,
        };
      }

      return {
        status: 'FALHOU',
        motivo:
          'Não foi encontrado preço estruturado confiável na página. O valor salvo não foi alterado.',
      };
    }

    return { status: 'FALHOU', motivo: 'Não foi possível verificar a URL.' };
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
      return {
        status: 'FALHOU',
        motivo: `URL original: ${original.motivo} URL afiliada: ${afiliada.motivo}`,
      };
    }

    return { ...original, urlConsultada: 'ORIGINAL' };
  }
}
