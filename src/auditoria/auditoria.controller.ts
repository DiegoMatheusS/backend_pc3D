import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AuditoriaService } from './auditoria.service';
import { FiltrarAuditoriaDto } from './dtos/filtrar-auditoria.dto';

@ApiTags('Auditoria')
@Controller('admin/auditoria')
@UseGuards(AuthGuard, AdminGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @ApiOperation({
    summary: 'Listar logs de auditoria com filtros (somente ADMIN)',
  })
  @Get()
  listar(@Query() filtros: FiltrarAuditoriaDto) {
    return this.auditoriaService.listar(filtros);
  }
}
