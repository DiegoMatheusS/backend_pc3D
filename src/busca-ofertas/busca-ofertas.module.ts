import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PapelGuard } from '../auth/papel.guard';
import { BuscaOfertasController } from './busca-ofertas.controller';
import { BuscaOfertasService } from './busca-ofertas.service';
import { ClassificadorOfertasService } from './classificador-ofertas.service';

@Module({
  imports: [AuthModule],
  controllers: [BuscaOfertasController],
  providers: [BuscaOfertasService, ClassificadorOfertasService, PapelGuard],
  exports: [BuscaOfertasService, ClassificadorOfertasService],
})
export class BuscaOfertasModule {}
