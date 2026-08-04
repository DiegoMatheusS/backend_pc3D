import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { IaService } from './ia.service';
import { ChatIaDto } from './dtos/chat-ia.dto';
import { MontarPcIaDto } from './dtos/montar-pc-ia.dto';
import { RecomendarLojaIaDto } from './dtos/recomendar-loja-ia.dto';

@ApiTags('IA Pública')
@Controller('ia')
@Throttle({ global: { limit: 20, ttl: 60_000 } })
export class IaController {
  constructor(private readonly iaService: IaService) {}

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

  @Post('loja/recomendar')
  @HttpCode(HttpStatus.OK)
  recomendarLoja(@Body() dados: RecomendarLojaIaDto) {
    return this.iaService.recomendarLoja(dados);
  }
}
