import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PapelGuard } from '../auth/papel.guard';
import { Papeis } from '../auth/papeis.decorator';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { PapelUsuario } from '../generated/prisma/enums';
import {
  BuscarProdutosShopeeDto,
  BuscarPromocoesShopeeDto,
  GerarLinkShopeeDto,
  SincronizarOfertasShopeeDto,
} from './dtos/buscar-shopee.dto';
import { ShopeeProjetoIaService } from './shopee-projeto-ia.service';

@ApiTags('Busca de Ofertas - Shopee')
@Controller('admin/busca-ofertas/shopee')
@UseGuards(AuthGuard, PapelGuard)
@Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
export class ShopeeBuscaOfertasController {
  constructor(private readonly shopee: ShopeeProjetoIaService) {}

  @Get('status')
  status() {
    return {
      integracao: 'SHOPEE_AFFILIATE_API_VIA_PROJETO_IA',
      projetoIaConfigurado: Boolean(
        process.env.PRODUTO_IA_URL?.trim() && process.env.PRODUTO_IA_API_KEY?.trim(),
      ),
      credencialShopeeNoBackend: false,
      observacao:
        'As credenciais da Shopee ficam somente no ProjetoIA; o backend usa a integração interna autenticada.',
    };
  }

  @Post('produtos')
  @HttpCode(HttpStatus.OK)
  buscarProdutos(@Body() dados: BuscarProdutosShopeeDto) {
    return this.shopee.buscarProdutos(dados);
  }

  @Post('promocoes')
  @HttpCode(HttpStatus.OK)
  buscarPromocoes(@Body() dados: BuscarPromocoesShopeeDto) {
    return this.shopee.buscarPromocoes(dados);
  }

  @Post('link-afiliado')
  @HttpCode(HttpStatus.OK)
  gerarLinkAfiliado(@Body() dados: GerarLinkShopeeDto) {
    return this.shopee.gerarLinkAfiliado(dados);
  }

  @Post('ofertas/:id/sincronizar')
  @HttpCode(HttpStatus.OK)
  sincronizarOferta(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.shopee.sincronizarOferta(id);
  }

  @Post('ofertas/sincronizar')
  @HttpCode(HttpStatus.OK)
  sincronizarOfertas(@Body() dados: SincronizarOfertasShopeeDto) {
    return this.shopee.sincronizarOfertas(dados.limite ?? 20);
  }
}
