import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BuildsModule } from '../builds/builds.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { ComentariosComunidadeController } from './comentarios-comunidade.controller';
import { ComunidadeController } from './comunidade.controller';
import { ComunidadeNotificacoesService } from './comunidade-notificacoes.service';
import { ComunidadeService } from './comunidade.service';

@Module({
  imports: [AuthModule, BuildsModule, NotificacoesModule],
  controllers: [ComunidadeController, ComentariosComunidadeController],
  providers: [ComunidadeService, ComunidadeNotificacoesService],
  exports: [ComunidadeService],
})
export class ComunidadeModule {}
