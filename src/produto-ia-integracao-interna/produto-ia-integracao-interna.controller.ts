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

  @Post('extensao/buscar-item')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 24, ttl: 60_000 } })
  buscarItem(
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() dados: BuscarItemExtensaoProdutoIaDto,
  ) {
    this.validarChave(apiKey);
    return this.integracao.buscarItemExtensao(dados);
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
