import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { PapelGuard } from '../auth/papel.guard';
import { Papeis } from '../auth/papeis.decorator';
import { PapelUsuario } from '../generated/prisma/enums';
import { DescobrirOfertasDto } from './dtos/descobrir-ofertas.dto';
import { DescobrirOfertasService } from './descobrir-ofertas.service';
@Controller('admin/busca-ofertas/descobrir')
@UseGuards(AuthGuard, PapelGuard)
@Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
export class DescobrirOfertasController {
  constructor(private readonly service: DescobrirOfertasService) {}
  @Get('status') status() {
    return this.service.status();
  }
  @Post()
  @HttpCode(200)
  @Throttle({ global: { limit: 12, ttl: 60000 } })
  buscar(@Body() dados: DescobrirOfertasDto) {
    return this.service.buscar(dados);
  }
}
