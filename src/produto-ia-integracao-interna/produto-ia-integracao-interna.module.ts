import { Module } from '@nestjs/common';
import { HardwaresDescobertaIaModule } from '../hardwares-descoberta-ia/hardwares-descoberta-ia.module';
import { HardwaresModule } from '../hardwares/hardwares.module';
import { OfertasModule } from '../ofertas/ofertas.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { ProdutoIaIntegracaoInternaController } from './produto-ia-integracao-interna.controller';
import { ProdutoIaIntegracaoInternaService } from './produto-ia-integracao-interna.service';

@Module({
  imports: [
    HardwaresDescobertaIaModule,
    HardwaresModule,
    OfertasModule,
    ProdutosModule,
  ],
  controllers: [ProdutoIaIntegracaoInternaController],
  providers: [ProdutoIaIntegracaoInternaService],
})
export class ProdutoIaIntegracaoInternaModule {}
