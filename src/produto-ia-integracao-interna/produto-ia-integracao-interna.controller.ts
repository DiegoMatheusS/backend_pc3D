import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BuscarItemExtensaoProdutoIaDto } from './dtos/buscar-item-extensao-produto-ia.dto';
import { ImportarOfertaExtensaoProdutoIaDto } from './dtos/importar-oferta-extensao-produto-ia.dto';
import { ProdutoIaIntegracaoInternaService } from './produto-ia-integracao-interna.service';

@Controller('interno/produto-ia')
export class ProdutoIaIntegracaoInternaController {
  constructor(
    private readonly integracao: ProdutoIaIntegracaoInternaService,
  ) {}

  private validarChave(chaveRecebida?: string): void {
    const esperada = process.env.PRODUTO_IA_API_KEY?.trim();
    const recebida = chaveRecebida?.trim();

    if (!esperada || !recebida || recebida !== esperada) {
      throw new UnauthorizedException('Chave interna da Produto IA inválida.');
    }
  }

  private normalizarTitulo(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, ' ')
      .trim();
  }

  private tituloComputadorCompleto(value: unknown): boolean {
    const titulo = this.normalizarTitulo(value);
    if (/^(?:mini pc|mini computador)\b/u.test(titulo)) return false;
    if (/^(?:computador|pc|desktop)\s+(?:notebook|portatil|laptop|gabinete|case|processador|cpu|placa|memoria|fonte|ssd|de bordo)\b/u.test(titulo)) {
      return false;
    }
    return /^(?:computador|pc|desktop)\s+(?:de mesa|gamer|montado|completo|all in one|intel|amd|core|ryzen|celeron|pentium|i[3579]\s*\d{3,5})\b/u.test(titulo);
  }

  @Post('extensao/buscar-item')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 24, ttl: 60_000 } })
  async buscarItem(
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() dados: BuscarItemExtensaoProdutoIaDto,
  ) {
    this.validarChave(apiKey);
    const encontrado = await this.integracao.buscarItemExtensao(dados);

    // A marca/modelo da CPU mencionada no anúncio não identifica o PC completo.
    // PC montado só pode se vincular a um Produto existente do mesmo equipamento.
    if (this.tituloComputadorCompleto(dados.nome) && encontrado.status === 'EXISTENTE') {
      const nomeEncontrado = encontrado.item?.nome;
      if (
        encontrado.tipo !== 'PRODUTO' ||
        !this.tituloComputadorCompleto(nomeEncontrado) ||
        this.normalizarTitulo(nomeEncontrado) !== this.normalizarTitulo(dados.nome)
      ) {
        return {
          status: 'AMBIGUO' as const,
          motivo: 'O anúncio é de um computador completo. Não vincule a oferta automaticamente a uma peça ou a uma configuração diferente; revise como PC montado.',
          candidatos: [],
        };
      }
    }

    return encontrado;
  }

  @Post('extensao/importar-oferta')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 12, ttl: 60_000 } })
  importarOferta(
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() dados: ImportarOfertaExtensaoProdutoIaDto,
  ) {
    this.validarChave(apiKey);
    return this.integracao.importarOfertaExtensao(dados);
  }
}
