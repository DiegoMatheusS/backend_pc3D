import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PapelGuard } from '../auth/papel.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ProdutoLikesController } from './produto-likes.controller';
import { ProdutoLikesService } from './produto-likes.service';
import {
  CategoriasProdutosAdminController,
  CategoriasProdutosController,
  ProdutosAdminController,
  ProdutosController,
} from './produtos.controller';
import { ProdutosService } from './produtos.service';
import { ProdutoImagemAdminController } from './produto-imagem.controller';
import { ProdutoImagemService } from './produto-imagem.service';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [
    ProdutosController,
    ProdutoLikesController,
    ProdutosAdminController,
    ProdutoImagemAdminController,
    CategoriasProdutosController,
    CategoriasProdutosAdminController,
  ],
  providers: [
    ProdutosService,
    ProdutoLikesService,
    ProdutoImagemService,
    PapelGuard,
  ],
  exports: [ProdutosService],
})
export class ProdutosModule {}
