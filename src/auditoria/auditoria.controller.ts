import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import { AcaoAuditoria } from '../generated/prisma/enums';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('Auditoria')
@Controller('admin/auditoria')
@UseGuards(AuthGuard, AdminGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @ApiOperation({
    summary: 'Listar logs de auditoria com filtros (somente ADMIN)',
  })
  @Get()
  listar(
    @Query('acao') acao?: AcaoAuditoria,
    @Query('entidade') entidade?: string,
    @Query('entidadeId') entidadeId?: string,
    @Query('usuarioId', new ParseIntPipe({ optional: true }))
    usuarioId?: number,
    @Query('pagina', new ParseIntPipe({ optional: true })) pagina?: number,
    @Query('porPagina', new ParseIntPipe({ optional: true }))
    porPagina?: number,
  ) {
    return this.auditoriaService.listar({
      acao,
      entidade,
      entidadeId,
      usuarioId,
      pagina,
      porPagina,
    });
  }
}
