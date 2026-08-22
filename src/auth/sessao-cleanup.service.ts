import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessaoCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessaoCleanupService.name);
  private intervalo?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    void this.limparSessoesAntigas();

    this.intervalo = setInterval(
      () => void this.limparSessoesAntigas(),
      6 * 60 * 60 * 1_000,
    );
    this.intervalo.unref();
  }

  onModuleDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  private async limparSessoesAntigas(): Promise<void> {
    const agora = new Date();
    const revogadasAntesDe = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);

    try {
      const resultado = await this.prisma.sessao.deleteMany({
        where: {
          OR: [
            { expiraEm: { lt: agora } },
            { revogadaEm: { lt: revogadasAntesDe } },
          ],
        },
      });

      if (resultado.count > 0) {
        this.logger.log(
          `${resultado.count} sessão(ões) antiga(s) removida(s).`,
        );
      }
    } catch {
      // Falha de manutenção não deve derrubar a API; será tentado novamente.
      this.logger.warn(
        'Não foi possível executar a limpeza periódica de sessões.',
      );
    }
  }
}
