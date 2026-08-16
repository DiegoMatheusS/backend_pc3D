import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PapelGuard } from '../auth/papel.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import {
  CategoriasProdutosAdminController,
  CategoriasProdutosController,
  ProdutosAdminController,
  ProdutosController,
} from './produtos.controller';
import { ProdutosService } from './produtos.service';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [
    ProdutosController,
    ProdutosAdminController,
    CategoriasProdutosController,
    CategoriasProdutosAdminController,
  ],
  providers: [ProdutosService, PapelGuard],
  exports: [ProdutosService],
})
export class ProdutosModule {}
