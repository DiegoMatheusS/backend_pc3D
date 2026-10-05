import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { validarUrlPublica } from '../common/security/external-http-security';
import { postProdutoIa } from '../ia/produto-ia-http';
import type { BuscarImagemProdutoDto } from './dtos/buscar-imagem-produto.dto';

function registro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function texto(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

@Injectable()
export class ProdutoImagemService {
  async buscar(dados: BuscarImagemProdutoDto) {
    const identidade = {
      nome: texto(dados.nome),
      marca: texto(dados.marca) || null,
      modelo: texto(dados.modelo) || null,
      mpn: texto(dados.mpn) || null,
      gtin: texto(dados.gtin) || null,
    };
    if (!identidade.modelo && !identidade.mpn && !identidade.gtin) {
      throw new BadRequestException(
        'Preencha o modelo, MPN ou GTIN/EAN para buscar a imagem do mesmo produto.',
      );
    }
    const baseUrl = process.env.PRODUTO_IA_URL?.trim().replace(/\/+$/, '');
    const apiKey = process.env.PRODUTO_IA_API_KEY?.trim();
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException(
        'ProjetoIA não configurado para buscar imagens de produtos.',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    let resultado: unknown;
    try {
      const resposta = await postProdutoIa(`${baseUrl}/ofertas/produto-identico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ ...identidade, limitePorLoja: 3 }),
        signal: controller.signal,
      });
      if (!resposta.ok) {
        throw new BadGatewayException(
          'Não foi possível consultar as lojas para buscar a imagem do produto.',
        );
      }
      resultado = await resposta.json();
    } catch (erro) {
      if (erro instanceof BadGatewayException) throw erro;
      throw new BadGatewayException(
        erro instanceof Error && erro.name === 'AbortError'
          ? 'Tempo esgotado ao buscar imagem. Tente novamente.'
          : 'Não foi possível obter as imagens das lojas. Tente novamente.',
      );
    } finally {
      clearTimeout(timer);
    }

    if (!registro(resultado) || !Array.isArray(resultado.ofertas)) {
      throw new BadGatewayException('As lojas retornaram uma resposta inválida.');
    }
    for (const oferta of resultado.ofertas) {
      if (!registro(oferta)) continue;
      const imagem = texto(oferta.imagemUrl);
      const criterio = texto(oferta.criterioIdentidade);
      if (!imagem || !criterio) continue;
      let imagemUrl: string;
      try {
        imagemUrl = (await validarUrlPublica(imagem)).url.toString();
      } catch {
        continue;
      }
      return {
        status: 'IMAGEM_ENCONTRADA' as const,
        imagemUrl,
        fonte: texto(oferta.parceiro) || texto(oferta.marketplace) || null,
        urlFonte: texto(oferta.urlOriginal) || null,
        correspondencia: {
          nome: texto(oferta.nomeEncontrado) || identidade.nome,
          criterio,
        },
      };
    }
    throw new BadGatewayException(
      'Não encontrei uma imagem válida do mesmo produto nas lojas consultadas.',
    );
  }
}
