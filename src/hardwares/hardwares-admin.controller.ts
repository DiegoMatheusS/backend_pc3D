import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AtualizarHardwareDto } from './dtos/atualizar-hardware.dto';
import { HardwaresService } from './hardwares.service';
import { CriarCompatibilidadeCpuPlacaMaeDto } from './dtos/criar-compatibilidade-cpu-placa-mae.dto';
import { CriarCompatibilidadeMemoriaPlacaMaeDto } from './dtos/criar-compatibilidade-memoria-placa-mae.dto';
import { CriarModelo3DHardwareDto } from './dtos/modelos-3d/criar-modelo-3d-hardware.dto';
import { AtualizarStatusModelo3DDto } from './dtos/modelos-3d/atualizar-status-modelo-3d.dto';
import { AtualizarModelo3DHardwareDto } from './dtos/modelos-3d/atualizar-modelo-3d-hardware.dto';
import { CriarPontoEncaixeHardwareDto } from './dtos/modelos-3d/criar-ponto-encaixe-hardware.dto';
import { CriarAjusteEncaixeHardwareDto } from './dtos/modelos-3d/criar-ajuste-encaixe-hardware.dto';
import { AtualizarPontoEncaixeHardwareDto } from './dtos/modelos-3d/atualizar-ponto-encaixe-hardware.dto';
import { AtualizarAjusteEncaixeHardwareDto } from './dtos/modelos-3d/atualizar-ajuste-encaixe-hardware.dto';

@Controller('admin/hardwares')
@UseGuards(AuthGuard, AdminGuard)
export class HardwaresAdminController {
  constructor(private readonly hardwaresService: HardwaresService) {}

  @Get()
  listarTodos() {
    return this.hardwaresService.listarTodos();
  }

  @Get(':hardwareId/modelos-3d')
  listarModelos3DHardwareAdmin(
    @Param('hardwareId', ParseIntPipe) hardwareId: number,
  ) {
    return this.hardwaresService.listarModelos3DHardwareAdmin(hardwareId);
  }

  @Post(':hardwareId/modelos-3d')
  criarModelo3DHardware(
    @Param('hardwareId', ParseIntPipe) hardwareId: number,
    @Body() dados: CriarModelo3DHardwareDto,
  ) {
    return this.hardwaresService.criarModelo3DHardware(hardwareId, dados);
  }

  @Patch('modelos-3d/:modeloId/aprovar')
  aprovarModelo3DHardware(@Param('modeloId', ParseIntPipe) modeloId: number) {
    return this.hardwaresService.aprovarModelo3DHardware(modeloId);
  }

  @Patch('modelos-3d/:modeloId/status')
  atualizarStatusModelo3DHardware(
    @Param('modeloId', ParseIntPipe) modeloId: number,
    @Body() dados: AtualizarStatusModelo3DDto,
  ) {
    return this.hardwaresService.atualizarStatusModelo3DHardware(
      modeloId,
      dados,
    );
  }

  @Patch('modelos-3d/:modeloId')
  atualizarModelo3DHardware(
    @Param('modeloId', ParseIntPipe) modeloId: number,
    @Body() dados: AtualizarModelo3DHardwareDto,
  ) {
    return this.hardwaresService.atualizarModelo3DHardware(modeloId, dados);
  }

  @Post(':hardwarePaiId/pontos-encaixe')
  criarPontoEncaixeHardware(
    @Param('hardwarePaiId', ParseIntPipe) hardwarePaiId: number,
    @Body() dados: CriarPontoEncaixeHardwareDto,
  ) {
    return this.hardwaresService.criarPontoEncaixeHardware(
      hardwarePaiId,
      dados,
    );
  }

  @Get(':hardwarePaiId/pontos-encaixe')
  listarPontosEncaixeHardwareAdmin(
    @Param('hardwarePaiId', ParseIntPipe) hardwarePaiId: number,
  ) {
    return this.hardwaresService.listarPontosEncaixeHardwareAdmin(
      hardwarePaiId,
    );
  }

  @Post('pontos-encaixe/:pontoEncaixeId/ajustes')
  criarAjusteEncaixeHardware(
    @Param('pontoEncaixeId', ParseIntPipe) pontoEncaixeId: number,
    @Body() dados: CriarAjusteEncaixeHardwareDto,
  ) {
    return this.hardwaresService.criarAjusteEncaixeHardware(
      pontoEncaixeId,
      dados,
    );
  }

  @Patch('pontos-encaixe/:pontoEncaixeId')
  atualizarPontoEncaixeHardware(
    @Param('pontoEncaixeId', ParseIntPipe) pontoEncaixeId: number,
    @Body() dados: AtualizarPontoEncaixeHardwareDto,
  ) {
    return this.hardwaresService.atualizarPontoEncaixeHardware(
      pontoEncaixeId,
      dados,
    );
  }

  @Patch('ajustes-encaixe/:ajusteId')
  atualizarAjusteEncaixeHardware(
    @Param('ajusteId', ParseIntPipe) ajusteId: number,
    @Body() dados: AtualizarAjusteEncaixeHardwareDto,
  ) {
    return this.hardwaresService.atualizarAjusteEncaixeHardware(
      ajusteId,
      dados,
    );
  }

  @Post('compatibilidades/cpu-placa-mae')
  criarCompatibilidadeCpuPlacaMae(
    @Body() dados: CriarCompatibilidadeCpuPlacaMaeDto,
  ) {
    return this.hardwaresService.criarCompatibilidadeCpuPlacaMae(dados);
  }

  @Get('compatibilidades/cpu-placa-mae')
  listarCompatibilidadesCpuPlacaMae() {
    return this.hardwaresService.listarCompatibilidadesCpuPlacaMae();
  }

  @Post('compatibilidades/memoria-placa-mae')
  criarCompatibilidadeMemoriaPlacaMae(
    @Body() dados: CriarCompatibilidadeMemoriaPlacaMaeDto,
  ) {
    return this.hardwaresService.criarCompatibilidadeMemoriaPlacaMae(dados);
  }

  @Get('compatibilidades/memoria-placa-mae')
  listarCompatibilidadesMemoriaPlacaMae() {
    return this.hardwaresService.listarCompatibilidadesMemoriaPlacaMae();
  }

  @Get('compatibilidades/memoria-placa-mae/:placaMaeId/:memoriaRamId')
  verificarCompatibilidadeMemoriaPlacaMae(
    @Param('placaMaeId', ParseIntPipe) placaMaeId: number,
    @Param('memoriaRamId', ParseIntPipe) memoriaRamId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadeMemoriaPlacaMae(
      placaMaeId,
      memoriaRamId,
    );
  }

  @Get(':id')
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.hardwaresService.buscarPorIdAdmin(id);
  }

  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dados: AtualizarHardwareDto,
  ) {
    return this.hardwaresService.atualizar(id, dados);
  }

  @Delete(':id/permanente')
  removerPermanentemente(@Param('id', ParseIntPipe) id: number) {
    return this.hardwaresService.removerPermanentemente(id);
  }

  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.hardwaresService.remover(id);
  }
}
