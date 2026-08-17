import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { IaService } from './ia.service';
import { ChatIaDto } from './dtos/chat-ia.dto';
import { MontarPcIaDto } from './dtos/montar-pc-ia.dto';
import { RecomendarLojaIaDto } from './dtos/recomendar-loja-ia.dto';
import { MontagemGuiadaIaDto } from './dtos/montagem-guiada-ia.dto';

@ApiTags('IA Pública')
@Controller('ia')
@Throttle({ global: { limit: 20, ttl: 60_000 } })
export class IaController {
  constructor(private readonly iaService: IaService) {}

  @Get('status')
  status() {
    return this.iaService.status();
  }

  @Get('menu')
  menu() {
    return this.iaService.menuPublico();
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() dados: ChatIaDto) {
    return this.iaService.chat(dados);
  }

  @Post('montar-pc')
  @HttpCode(HttpStatus.OK)
  montarPc(@Body() dados: MontarPcIaDto) {
    return this.iaService.montarPc(dados);
  }

  @Post('montagem-guiada')
  @HttpCode(HttpStatus.OK)
  montagemGuiada(@Body() dados: MontagemGuiadaIaDto) {
    return this.iaService.montagemGuiada(dados);
  }

  @Post('loja/recomendar')
  @HttpCode(HttpStatus.OK)
  recomendarLoja(@Body() dados: RecomendarLojaIaDto) {
    return this.iaService.recomendarLoja(dados);
  }
}
