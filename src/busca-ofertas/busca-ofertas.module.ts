import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PapelGuard } from '../auth/papel.guard';
import { BuscaOfertasController } from './busca-ofertas.controller';
import { BuscaOfertasService } from './busca-ofertas.service';
import { ClassificadorOfertasService } from './classificador-ofertas.service';
import { MercadoLivreBuscaOfertasController } from './mercadolivre-busca-ofertas.controller';
import { MercadoLivreProjetoIaService } from './mercadolivre-projeto-ia.service';
import { ShopeeBuscaOfertasController } from './shopee-busca-ofertas.controller';
import { ShopeeProjetoIaService } from './shopee-projeto-ia.service';

@Module({
  imports: [AuthModule],
  controllers: [
    BuscaOfertasController,
    ShopeeBuscaOfertasController,
    MercadoLivreBuscaOfertasController,
  ],
  providers: [
    BuscaOfertasService,
    ClassificadorOfertasService,
    ShopeeProjetoIaService,
    MercadoLivreProjetoIaService,
    PapelGuard,
  ],
  exports: [
    BuscaOfertasService,
    ClassificadorOfertasService,
    ShopeeProjetoIaService,
    MercadoLivreProjetoIaService,
  ],
})
export class BuscaOfertasModule {}
