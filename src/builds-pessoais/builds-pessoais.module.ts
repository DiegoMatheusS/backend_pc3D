import {
  ForbiddenException,
  Headers,
  BadRequestException,
  ConflictException,
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, Min, IsObject } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { IsSafeJsonObject } from '../common/validators/is-safe-json-object.validator';
import { ParseSlugPipe } from '../common/pipes/parse-slug.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

function snapshot(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(snapshot).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([key]) => key !== '_revisao')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${snapshot(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

class SalvarBuildPessoalDto {
  @IsObject()
  @IsSafeJsonObject({
    maxDepth: 9,
    maxKeys: 1000,
    maxArrayLength: 128,
    maxStringLength: 30000,
  })
  dados!: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(1) revisao?: number;
}
class ExcluirBuildPessoalDto {
  @IsOptional() @IsInt() @Min(1) revisao?: number;
}

@Controller('builds-pessoais')
@UseGuards(AuthGuard)
export class BuildsPessoaisController {
  constructor(private readonly prisma: PrismaService) {}
  private assertOwner(req: { usuario: { email: string } }, owner: string) {
    if (
      !owner ||
      owner.toLowerCase().trim() !== req.usuario.email.toLowerCase()
    )
      throw new ForbiddenException(
        'A conta mudou. Entre novamente antes de sincronizar.',
      );
  }
  @Get()
  async listar(
    @Req() req: { usuario: { id: number; email: string } },
    @Headers('x-criabyte-account') owner: string,
  ) {
    this.assertOwner(req, owner);
    const rows = await this.prisma.buildPessoal.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { atualizadoEm: 'desc' },
      take: 500,
    });
    return rows.map((row) => ({
      ...(row.dados as object),
      id: row.clienteId,
      _revisao: row.revisao,
    }));
  }
  @Put(':id')
  @Throttle({ global: { limit: 60, ttl: 60000 } })
  async salvar(
    @Req() req: { usuario: { id: number; email: string } },
    @Param('id', ParseSlugPipe) id: string,
    @Body() body: SalvarBuildPessoalDto,
    @Headers('x-criabyte-account') owner: string,
  ) {
    this.assertOwner(req, owner);
    if (
      id.length > 100 ||
      typeof body.dados.nome !== 'string' ||
      !body.dados.nome.trim() ||
      body.dados.nome.length > 200 ||
      !body.dados.configuracao ||
      typeof body.dados.configuracao !== 'object' ||
      Array.isArray(body.dados.configuracao)
    )
      throw new BadRequestException('Build inválida.');
    const dados = { ...body.dados, id } as Prisma.InputJsonObject;
    const usuarioId = req.usuario.id;
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${usuarioId}, 2941)`;
      const current = await tx.buildPessoal.findUnique({
        where: { usuarioId_clienteId: { usuarioId, clienteId: id } },
      });
      if (current) {
        if (snapshot(current.dados) === snapshot(dados)) return current;
        if (body.revisao !== current.revisao)
          throw new ConflictException(
            'Esta build foi alterada em outro aparelho. Sua cópia local foi preservada; escolha como resolver em Minhas builds.',
          );
        return tx.buildPessoal.update({
          where: { usuarioId_clienteId: { usuarioId, clienteId: id } },
          data: { dados, revisao: { increment: 1 } },
        });
      }
      if (body.revisao)
        throw new ConflictException(
          'Esta build foi excluída em outro aparelho. Você pode salvar sua cópia em Minhas builds.',
        );
      if ((await tx.buildPessoal.count({ where: { usuarioId } })) >= 500)
        throw new BadRequestException('Limite de 500 builds atingido.');
      return tx.buildPessoal.create({
        data: { usuarioId, clienteId: id, dados },
      });
    });
  }

  @Delete(':id')
  async remover(
    @Req() req: { usuario: { id: number; email: string } },
    @Param('id', ParseSlugPipe) id: string,
    @Headers('x-criabyte-account') owner: string,
    @Body() body: ExcluirBuildPessoalDto,
  ) {
    this.assertOwner(req, owner);
    const usuarioId = req.usuario.id;
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${usuarioId}, 2941)`;
      const current = await tx.buildPessoal.findUnique({
        where: { usuarioId_clienteId: { usuarioId, clienteId: id } },
      });
      if (current && body?.revisao !== current.revisao)
        throw new ConflictException(
          'Esta build mudou em outro aparelho. A exclusão aguarda sua decisão em Minhas builds.',
        );
      return tx.buildPessoal.deleteMany({
        where: { usuarioId, clienteId: id },
      });
    });
  }
}

@Module({ imports: [AuthModule], controllers: [BuildsPessoaisController] })
export class BuildsPessoaisModule {}
