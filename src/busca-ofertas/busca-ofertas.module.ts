import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PapelGuard } from '../auth/papel.guard';
import { BuscaOfertasController } from './busca-ofertas.controller';
import { BuscaOfertasService } from './busca-ofertas.service';
import { ClassificadorOfertasService } from './classificador-ofertas.service';
import { ShopeeBuscaOfertasController } from './shopee-busca-ofertas.controller';
import { ShopeeProjetoIaService } from './shopee-projeto-ia.service';

@Module({
  imports: [AuthModule],
  controllers: [BuscaOfertasController, ShopeeBuscaOfertasController],
  providers: [
    BuscaOfertasService,
    ClassificadorOfertasService,
    ShopeeProjetoIaService,
    PapelGuard,
  ],
  exports: [
    BuscaOfertasService,
    ClassificadorOfertasService,
    ShopeeProjetoIaService,
  ],
})
export class BuscaOfertasModule {}
