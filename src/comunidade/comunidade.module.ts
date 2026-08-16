import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BuildsModule } from '../builds/builds.module';
import { ComentariosComunidadeController } from './comentarios-comunidade.controller';
import { ComunidadeController } from './comunidade.controller';
import { ComunidadeService } from './comunidade.service';

@Module({
  imports: [AuthModule, BuildsModule],
  controllers: [ComunidadeController, ComentariosComunidadeController],
  providers: [ComunidadeService],
  exports: [ComunidadeService],
})
export class ComunidadeModule {}
