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
  ConsultarProdutoMercadoLivreDto,
  SincronizarOfertasMercadoLivreDto,
} from './dtos/mercadolivre.dto';
import { MercadoLivreProjetoIaService } from './mercadolivre-projeto-ia.service';

@ApiTags('Busca de Ofertas - Mercado Livre')
@Controller('admin/busca-ofertas/mercadolivre')
@UseGuards(AuthGuard, PapelGuard)
@Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
export class MercadoLivreBuscaOfertasController {
  constructor(private readonly mercadoLivre: MercadoLivreProjetoIaService) {}

  @Get('status')
  status() {
    return {
      integracao: 'MERCADO_LIVRE_API_VIA_PROJETO_IA',
      projetoIaConfigurado: Boolean(
        process.env.PRODUTO_IA_URL?.trim() &&
          process.env.PRODUTO_IA_API_KEY?.trim(),
      ),
      credencialMercadoLivreNoBackend: false,
      observacao:
        'Client ID, Client Secret e tokens do Mercado Livre ficam somente no ProjetoIA; o backend usa a integração interna autenticada.',
    };
  }

  @Post('produto')
  @HttpCode(HttpStatus.OK)
  consultarProduto(@Body() dados: ConsultarProdutoMercadoLivreDto) {
    return this.mercadoLivre.consultarProduto(dados);
  }

  @Post('ofertas/:id/sincronizar')
  @HttpCode(HttpStatus.OK)
  sincronizarOferta(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.mercadoLivre.sincronizarOferta(id);
  }

  @Post('ofertas/sincronizar')
  @HttpCode(HttpStatus.OK)
  sincronizarOfertas(@Body() dados: SincronizarOfertasMercadoLivreDto) {
    return this.mercadoLivre.sincronizarOfertas(dados.limite ?? 20);
  }
}
