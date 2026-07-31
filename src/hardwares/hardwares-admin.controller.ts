import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AtualizarHardwareDto } from './dtos/atualizar-hardware.dto';
import { HardwaresService } from './hardwares.service';

@Controller('admin/hardwares')
@UseGuards(AuthGuard, AdminGuard)
export class HardwaresAdminController {
  constructor(private readonly hardwaresService: HardwaresService) {}

  @Get()
  listarTodos() {
    return this.hardwaresService.listarTodos();
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
