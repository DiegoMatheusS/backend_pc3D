import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PapelGuard } from '../auth/papel.guard';
import { Papeis } from '../auth/papeis.decorator';
import { PapelUsuario } from '../generated/prisma/enums';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { BuscaOfertasService } from './busca-ofertas.service';
import { FiltrarBuscaOfertasDto } from './dtos/filtrar-busca-ofertas.dto';

@ApiTags('Busca de Ofertas')
@Controller('admin/busca-ofertas')
@UseGuards(AuthGuard, PapelGuard)
@Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
export class BuscaOfertasController {
  constructor(private readonly buscaOfertasService: BuscaOfertasService) {}

  @Get()
  listar(@Query() filtros: FiltrarBuscaOfertasDto) {
    return this.buscaOfertasService.listar(filtros);
  }

  @Get('status')
  status() {
    return this.buscaOfertasService.status();
  }

  @Post('atualizar')
  @HttpCode(HttpStatus.OK)
  atualizar(@Query() filtros: FiltrarBuscaOfertasDto) {
    return this.buscaOfertasService.atualizar(filtros);
  }

  @Post('produto/:id/encontrar-e-cadastrar')
  @HttpCode(HttpStatus.OK)
  encontrarECadastrarOfertasIdenticas(
    @Param('id', ParsePositiveIntPipe) id: number,
  ) {
    return this.buscaOfertasService.encontrarECadastrarOfertasIdenticas(id);
  }
}
