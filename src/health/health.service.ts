import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok';
  bancoDeDados: 'conectado';
  dataHora: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async obterStatus(): Promise<HealthStatus> {
    // Consulta constante, sem entrada do usuário, apenas para confirmar conexão.
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      bancoDeDados: 'conectado',
      dataHora: new Date().toISOString(),
    };
  }
}
