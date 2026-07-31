import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CriarHardwareDto } from './dtos/criar-hardware.dto';
import { HardwaresService } from './hardwares.service';

@Controller('hardwares')
export class HardwaresController {
  constructor(private readonly hardwaresService: HardwaresService) {}

  @Get()
  listarPublicados() {
    return this.hardwaresService.listarPublicados();
  }

  @Get(':id')
  buscarPublicadoPorId(@Param('id', ParseIntPipe) id: number) {
    return this.hardwaresService.buscarPublicadoPorId(id);
  }

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  criar(@Body() dados: CriarHardwareDto) {
    return this.hardwaresService.criar(dados);
  }
}
