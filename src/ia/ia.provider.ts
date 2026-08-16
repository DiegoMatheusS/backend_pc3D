import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
<<<<<<< HEAD
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';

type PapelConteudoIa = 'user' | 'model';

export type ConteudoIa = {
  role: PapelConteudoIa;
  parts: Array<{ text: string }>;
};

type OpcoesGeracaoIa = {
  promptSistema?: string;
  conteudos: string | ConteudoIa[];
  modelo?: string;
  temperatura?: number;
  maxOutputTokens?: number;
  json?: boolean;
};

type OpcoesPesquisaWebIa = {
  prompt: string;
  urls?: string[];
  usarPesquisaGoogle?: boolean;
  modelo?: string;
};

export type FonteWebIa = {
  url: string;
  titulo?: string;
  origem: 'URL_CONTEXT' | 'GOOGLE_SEARCH' | 'CITACAO';
};

const MODELO_PADRAO = 'gemini-3.6-flash';
=======
import {
  GoogleGenerativeAI,
  GenerativeModel,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c

@Injectable()
export class IaProvider {
  private readonly logger = new Logger(IaProvider.name);
<<<<<<< HEAD
  private readonly cliente: GoogleGenAI | null;
  private readonly modeloConfigurado: string;

  constructor(private readonly configService: ConfigService) {
    const chave = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    this.modeloConfigurado =
      this.configService.get<string>('GEMINI_MODEL')?.trim() || MODELO_PADRAO;

    if (chave) {
      this.cliente = new GoogleGenAI({ apiKey: chave });
    } else {
      this.cliente = null;
=======
  private readonly cliente: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const chave = this.configService.get<string>('GEMINI_API_KEY');

    if (chave) {
      this.cliente = new GoogleGenerativeAI(chave);
    } else {
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
      this.logger.warn(
        'GEMINI_API_KEY não configurada. Respostas da IA estarão indisponíveis.',
      );
    }
  }

<<<<<<< HEAD
  estaDisponivel(): boolean {
    return this.cliente !== null;
  }

  obterNomeModelo(nomeModelo?: string): string {
    return nomeModelo?.trim() || this.modeloConfigurado || MODELO_PADRAO;
  }

  private obterCliente(): GoogleGenAI {
=======
  obterModelo(nomeModelo?: string): GenerativeModel {
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
    if (!this.cliente) {
      throw new ServiceUnavailableException(
        'O assistente de IA não está disponível no momento. Configure a chave da API.',
      );
    }

<<<<<<< HEAD
    return this.cliente;
  }

  private ehRegistro(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  }

  private mensagemErro(erro: unknown): string {
    return erro instanceof Error ? erro.message : 'erro desconhecido';
  }

  private erroIndicaModeloIndisponivel(erro: unknown): boolean {
    const mensagem = this.mensagemErro(erro).toLowerCase();
    return (
      mensagem.includes('404') ||
      mensagem.includes('not found') ||
      mensagem.includes('not_found') ||
      mensagem.includes('model is not found')
    );
  }

  private erroIndicaQuotaExcedida(erro: unknown): boolean {
    const mensagem = this.mensagemErro(erro).toLowerCase();
    return (
      mensagem.includes('429') ||
      mensagem.includes('resource_exhausted') ||
      mensagem.includes('rate limit') ||
      mensagem.includes('rate-limit') ||
      mensagem.includes('quota')
    );
  }

  private async executarGeracao(
    opcoes: OpcoesGeracaoIa,
    modelo: string,
  ): Promise<string> {
    const cliente = this.obterCliente();
    const resposta = await cliente.models.generateContent({
      model: modelo,
      contents: opcoes.conteudos,
      config: {
        ...(opcoes.promptSistema
          ? { systemInstruction: opcoes.promptSistema }
          : {}),
        temperature: opcoes.temperatura ?? 0.4,
        maxOutputTokens: opcoes.maxOutputTokens ?? 2048,
        ...(opcoes.json ? { responseMimeType: 'application/json' } : {}),
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      },
    });

    const texto = resposta.text?.trim();
    if (!texto) {
      throw new ServiceUnavailableException(
        'A IA não retornou conteúdo para esta solicitação.',
      );
    }

    return texto;
  }

  async gerarTexto(opcoes: OpcoesGeracaoIa): Promise<string> {
    const modelo = this.obterNomeModelo(opcoes.modelo);

    try {
      return await this.executarGeracao(opcoes, modelo);
    } catch (erro) {
      if (erro instanceof ServiceUnavailableException) {
        throw erro;
      }

      if (this.erroIndicaQuotaExcedida(erro)) {
        this.logger.warn(
          `Cota/limite do Gemini atingido (${modelo}): ${this.mensagemErro(erro)}`,
        );
        throw new ServiceUnavailableException(
          'A cota do assistente de IA foi atingida temporariamente (429). O recurso continuará usando fallbacks locais quando disponíveis.',
        );
      }

      // Se o .env ainda apontar para um modelo removido/preview, o backend não
      // cai em 500: tenta uma vez o modelo estável adotado pelo projeto.
      if (modelo !== MODELO_PADRAO && this.erroIndicaModeloIndisponivel(erro)) {
        this.logger.warn(
          `Modelo Gemini "${modelo}" indisponível. Tentando fallback para "${MODELO_PADRAO}".`,
        );

        try {
          return await this.executarGeracao(opcoes, MODELO_PADRAO);
        } catch (erroFallback) {
          this.logger.error(
            `Falha no fallback do Gemini: ${this.mensagemErro(erroFallback)}`,
          );
        }
      } else {
        this.logger.error(
          `Falha ao consultar o Gemini (${modelo}): ${this.mensagemErro(erro)}`,
        );
      }

      throw new ServiceUnavailableException(
        'O assistente de IA está temporariamente indisponível. Tente novamente em instantes.',
      );
    }
  }

  async gerarJson<T>(opcoes: Omit<OpcoesGeracaoIa, 'json'>): Promise<T> {
    const texto = await this.gerarTexto({ ...opcoes, json: true });

    try {
      return JSON.parse(texto) as T;
    } catch (erro) {
      this.logger.warn(
        `O Gemini retornou JSON inválido: ${this.mensagemErro(erro)}`,
      );
      throw new ServiceUnavailableException(
        'A IA retornou uma resposta inválida. Tente novamente.',
      );
    }
  }

  private extrairTextoInteracao(interacao: unknown): string {
    if (!this.ehRegistro(interacao)) return '';

    for (const chave of ['outputText', 'output_text']) {
      const valor = interacao[chave];
      if (typeof valor === 'string' && valor.trim()) return valor.trim();
    }

    if (!Array.isArray(interacao.steps)) return '';

    const trechos: string[] = [];
    for (const passo of interacao.steps) {
      if (!this.ehRegistro(passo) || passo.type !== 'model_output') continue;
      if (!Array.isArray(passo.content)) continue;

      for (const bloco of passo.content) {
        if (!this.ehRegistro(bloco) || bloco.type !== 'text') continue;
        if (typeof bloco.text === 'string' && bloco.text.trim()) {
          trechos.push(bloco.text.trim());
        }
      }
    }

    return trechos.join('\n\n').trim();
  }

  private extrairFontesInteracao(interacao: unknown): FonteWebIa[] {
    if (!this.ehRegistro(interacao) || !Array.isArray(interacao.steps)) {
      return [];
    }

    const fontes = new Map<string, FonteWebIa>();

    const adicionarFonte = (
      url: unknown,
      titulo: unknown,
      origem: FonteWebIa['origem'],
    ) => {
      if (typeof url !== 'string' || !url.startsWith('http')) return;
      if (fontes.has(url)) return;
      fontes.set(url, {
        url,
        ...(typeof titulo === 'string' && titulo.trim()
          ? { titulo: titulo.trim() }
          : {}),
        origem,
      });
    };

    for (const passo of interacao.steps) {
      if (!this.ehRegistro(passo)) continue;

      if (passo.type === 'url_context_result') {
        const resultado = passo.result;
        const itens = Array.isArray(resultado) ? resultado : [resultado];
        for (const item of itens) {
          if (!this.ehRegistro(item)) continue;
          adicionarFonte(
            item.url ?? item.retrievedUrl ?? item.retrieved_url,
            item.title,
            'URL_CONTEXT',
          );
        }
      }

      if (passo.type === 'model_output' && Array.isArray(passo.content)) {
        for (const bloco of passo.content) {
          if (!this.ehRegistro(bloco) || !Array.isArray(bloco.annotations)) {
            continue;
          }
          for (const anotacao of bloco.annotations) {
            if (!this.ehRegistro(anotacao)) continue;
            if (anotacao.type !== 'url_citation') continue;
            adicionarFonte(anotacao.url, anotacao.title, 'CITACAO');
          }
        }
      }
    }

    return [...fontes.values()];
  }

  async pesquisarWebComFontes(
    opcoes: OpcoesPesquisaWebIa,
  ): Promise<{ texto: string; fontes: FonteWebIa[] }> {
    const cliente = this.obterCliente();
    const modelo = this.obterNomeModelo(opcoes.modelo);
    const urls = Array.from(
      new Set((opcoes.urls ?? []).map((url) => url.trim()).filter(Boolean)),
    ).slice(0, 20);

    const ferramentas: Array<
      { type: 'url_context' } | { type: 'google_search' }
    > = [];
    if (urls.length > 0) ferramentas.push({ type: 'url_context' });
    if (opcoes.usarPesquisaGoogle) ferramentas.push({ type: 'google_search' });

    if (ferramentas.length === 0) {
      return {
        texto: await this.gerarTexto({
          conteudos: opcoes.prompt,
          modelo,
          maxOutputTokens: 4096,
          temperatura: 0.15,
        }),
        fontes: [],
      };
    }

    const complementoUrls =
      urls.length > 0
        ? `\n\nURLs fornecidas para leitura direta:\n${urls.map((url) => `- ${url}`).join('\n')}`
        : '';
    const input = `${opcoes.prompt}${complementoUrls}`;

    const executarPesquisa = async (modeloPesquisa: string) => {
      const interacao = await cliente.interactions.create({
        model: modeloPesquisa,
        input,
        tools: ferramentas,
        store: false,
      });
      const texto = this.extrairTextoInteracao(interacao);

      if (!texto) {
        throw new ServiceUnavailableException(
          'A IA não conseguiu obter conteúdo das fontes informadas.',
        );
      }

      return {
        texto,
        fontes: this.extrairFontesInteracao(interacao),
      };
    };

    try {
      return await executarPesquisa(modelo);
    } catch (erro) {
      if (erro instanceof ServiceUnavailableException) throw erro;

      if (this.erroIndicaQuotaExcedida(erro)) {
        this.logger.warn(
          `Cota/limite da pesquisa Gemini atingido (${modelo}): ${this.mensagemErro(erro)}`,
        );
        throw new ServiceUnavailableException(
          'A cota da pesquisa do Gemini foi atingida temporariamente (429).',
        );
      }

      if (modelo !== MODELO_PADRAO && this.erroIndicaModeloIndisponivel(erro)) {
        this.logger.warn(
          `Modelo Gemini "${modelo}" indisponível na pesquisa web. Tentando fallback para "${MODELO_PADRAO}".`,
        );

        try {
          return await executarPesquisa(MODELO_PADRAO);
        } catch (erroFallback) {
          this.logger.error(
            `Falha no fallback da pesquisa web do Gemini: ${this.mensagemErro(erroFallback)}`,
          );
        }
      } else {
        this.logger.error(
          `Falha ao consultar fontes web pelo Gemini (${modelo}): ${this.mensagemErro(erro)}`,
        );
      }

      throw new ServiceUnavailableException(
        'A consulta das fontes do produto está temporariamente indisponível.',
      );
    }
=======
    const modeloConfigurado =
      nomeModelo ??
      this.configService.get<string>('GEMINI_MODEL')?.trim() ??
      'gemini-2.0-flash';

    return this.cliente.getGenerativeModel({
      model: modeloConfigurado,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
  }

  estaDisponivel(): boolean {
    return this.cliente !== null;
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
  }
}
