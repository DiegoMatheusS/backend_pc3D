import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok';
  aplicacao: string;
  ambiente: string;
  bancoDeDados: 'conectado';
  usuariosCadastrados: number;
  dataHora: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async obterStatus(): Promise<HealthStatus> {
    const usuariosCadastrados = await this.prisma.usuario.count();

    return {
      status: 'ok',
      aplicacao: 'PC Builder API',
      ambiente: process.env.NODE_ENV ?? 'development',
      bancoDeDados: 'conectado',
      usuariosCadastrados,
      dataHora: new Date().toISOString(),
    };
  }
}
