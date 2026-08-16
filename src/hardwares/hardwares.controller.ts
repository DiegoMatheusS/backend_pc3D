import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { ParseQuantityPipe } from '../common/pipes/parse-quantity.pipe';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CriarHardwareDto } from './dtos/criar-hardware.dto';
import { HardwaresService } from './hardwares.service';
import { VerificarCompatibilidadeMontagemDto } from './dtos/verificar-compatibilidade-montagem.dto';
import { ResolverMontagem3DDto } from './dtos/modelos-3d/resolver-montagem-3d.dto';
import { ResolverMontagemCompletaDto } from './dtos/modelos-3d/resolver-montagem-completa.dto';
import { FiltrarHardwaresDto } from './dtos/filtrar-hardwares.dto';
import { PosicaoRefrigeracaoGabinete } from '../generated/prisma/enums';

@ApiTags('Hardwares')
@Controller('hardwares')
export class HardwaresController {
  constructor(private readonly hardwaresService: HardwaresService) {}

  @ApiOperation({ summary: 'Listar todos os hardwares publicados' })
  @Get()
  listarPublicados(@Query() filtros: FiltrarHardwaresDto) {
    return this.hardwaresService.listarPublicados(filtros);
  }

  @Get('compatibilidades/cpu-placa-mae/:placaMaeId/:processadorId')
  verificarCompatibilidadeCpuPlacaMae(
    @Param('placaMaeId', ParsePositiveIntPipe) placaMaeId: number,
    @Param('processadorId', ParsePositiveIntPipe) processadorId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadeCpuPlacaMae(
      placaMaeId,
      processadorId,
    );
  }

  @Get('compatibilidades/memoria-placa-mae/:placaMaeId/:memoriaRamId')
  verificarCompatibilidadeMemoriaPlacaMae(
    @Param('placaMaeId', ParsePositiveIntPipe) placaMaeId: number,
    @Param('memoriaRamId', ParsePositiveIntPipe) memoriaRamId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadeMemoriaPlacaMae(
      placaMaeId,
      memoriaRamId,
    );
  }

  @Get(
    'compatibilidades/conjunto-principal/:placaMaeId/:processadorId/:memoriaRamId',
  )
  verificarCompatibilidadeConjuntoPrincipal(
    @Param('placaMaeId', ParsePositiveIntPipe) placaMaeId: number,
    @Param('processadorId', ParsePositiveIntPipe) processadorId: number,
    @Param('memoriaRamId', ParsePositiveIntPipe) memoriaRamId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadeConjuntoPrincipal(
      placaMaeId,
      processadorId,
      memoriaRamId,
    );
  }

  @Get('compatibilidades/placa-mae-gabinete/:gabineteId/:placaMaeId')
  verificarCompatibilidadePlacaMaeGabinete(
    @Param('gabineteId', ParsePositiveIntPipe) gabineteId: number,
    @Param('placaMaeId', ParsePositiveIntPipe) placaMaeId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadePlacaMaeGabinete(
      gabineteId,
      placaMaeId,
    );
  }

  @Get('compatibilidades/fonte-gabinete/:gabineteId/:fonteId')
  verificarCompatibilidadeFonteGabinete(
    @Param('gabineteId', ParsePositiveIntPipe) gabineteId: number,
    @Param('fonteId', ParsePositiveIntPipe) fonteId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadeFonteGabinete(
      gabineteId,
      fonteId,
    );
  }

  @Get('compatibilidades/placa-video-gabinete/:gabineteId/:placaVideoId')
  verificarCompatibilidadePlacaVideoGabinete(
    @Param('gabineteId', ParsePositiveIntPipe) gabineteId: number,
    @Param('placaVideoId', ParsePositiveIntPipe) placaVideoId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadePlacaVideoGabinete(
      gabineteId,
      placaVideoId,
    );
  }

  @Get('compatibilidades/placa-video-fonte/:fonteId/:placaVideoId')
  verificarCompatibilidadePlacaVideoFonte(
    @Param('fonteId', ParsePositiveIntPipe) fonteId: number,
    @Param('placaVideoId', ParsePositiveIntPipe) placaVideoId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadePlacaVideoFonte(
      fonteId,
      placaVideoId,
    );
  }

  @Get(
    'compatibilidades/cooler-processador-gabinete/:gabineteId/:processadorId/:coolerId',
  )
  verificarCompatibilidadeCoolerProcessadorGabinete(
    @Param('gabineteId', ParsePositiveIntPipe) gabineteId: number,
    @Param('processadorId', ParsePositiveIntPipe) processadorId: number,
    @Param('coolerId', ParsePositiveIntPipe) coolerId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadeCoolerProcessadorGabinete(
      gabineteId,
      processadorId,
      coolerId,
    );
  }

  @Get('compatibilidades/ventoinha-gabinete/:gabineteId/:ventoinhaId')
  verificarCompatibilidadeVentoinhaGabinete(
    @Param('gabineteId', ParsePositiveIntPipe) gabineteId: number,
    @Param('ventoinhaId', ParsePositiveIntPipe) ventoinhaId: number,
    @Query('posicao', new ParseEnumPipe(PosicaoRefrigeracaoGabinete))
    posicao: PosicaoRefrigeracaoGabinete,
    @Query('quantidade', ParseQuantityPipe) quantidade: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadeVentoinhaGabinete(
      gabineteId,
      ventoinhaId,
      posicao,
      quantidade,
    );
  }

  @Get('compatibilidades/armazenamento-placa-mae/:placaMaeId/:armazenamentoId')
  verificarCompatibilidadeArmazenamentoPlacaMae(
    @Param('placaMaeId', ParsePositiveIntPipe) placaMaeId: number,
    @Param('armazenamentoId', ParsePositiveIntPipe) armazenamentoId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadeArmazenamentoPlacaMae(
      placaMaeId,
      armazenamentoId,
    );
  }

  @Get('compatibilidades/armazenamento-gabinete/:gabineteId/:armazenamentoId')
  verificarCompatibilidadeArmazenamentoGabinete(
    @Param('gabineteId', ParsePositiveIntPipe) gabineteId: number,
    @Param('armazenamentoId', ParsePositiveIntPipe) armazenamentoId: number,
  ) {
    return this.hardwaresService.verificarCompatibilidadeArmazenamentoGabinete(
      gabineteId,
      armazenamentoId,
    );
  }

  @ApiOperation({
    summary: 'Verificar compatibilidade completa de uma montagem',
  })
  @Post('compatibilidades/montagem')
  @Throttle({ global: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  verificarCompatibilidadeMontagem(
    @Body() dados: VerificarCompatibilidadeMontagemDto,
  ) {
    return this.hardwaresService.verificarCompatibilidadeMontagem(dados);
  }

  @Get(':hardwareId/modelos-3d')
  listarModelos3DHardwarePublico(
    @Param('hardwareId', ParsePositiveIntPipe) hardwareId: number,
  ) {
    return this.hardwaresService.listarModelos3DHardwarePublico(hardwareId);
  }

  @Get(
    ':hardwarePaiId/pontos-encaixe/:pontoEncaixeId/resolver/:hardwareFilhoId',
  )
  resolverEncaixeHardwarePublico(
    @Param('hardwarePaiId', ParsePositiveIntPipe) hardwarePaiId: number,
    @Param('pontoEncaixeId', ParsePositiveIntPipe) pontoEncaixeId: number,
    @Param('hardwareFilhoId', ParsePositiveIntPipe) hardwareFilhoId: number,
  ) {
    return this.hardwaresService.resolverEncaixeHardwarePublico(
      hardwarePaiId,
      pontoEncaixeId,
      hardwareFilhoId,
    );
  }

  @ApiTags('Montagem 3D')
  @ApiOperation({
    summary: 'Resolver montagem 3D + compatibilidade + consumo em uma chamada',
  })
  @Post(':gabineteId/montagem-completa/resolver')
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  resolverMontagemCompleta(
    @Param('gabineteId', ParsePositiveIntPipe) gabineteId: number,
    @Body() dados: ResolverMontagemCompletaDto,
  ) {
    return this.hardwaresService.resolverMontagemCompleta(gabineteId, dados);
  }

  @ApiTags('Montagem 3D')
  @ApiOperation({
    summary: 'Resolver estrutura 3D hierárquica por instâncias físicas',
  })
  @Post(':hardwarePaiId/montagem-3d/resolver')
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  resolverMontagem3DPublica(
    @Param('hardwarePaiId', ParsePositiveIntPipe) hardwarePaiId: number,
    @Body() dados: ResolverMontagem3DDto,
  ) {
    return this.hardwaresService.resolverMontagem3DPublica(
      hardwarePaiId,
      dados,
    );
  }

  @Get(':id')
  buscarPublicadoPorId(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.hardwaresService.buscarPublicadoPorId(id);
  }

  @Get(':hardwarePaiId/pontos-encaixe')
  listarPontosEncaixeHardwarePublico(
    @Param('hardwarePaiId', ParsePositiveIntPipe) hardwarePaiId: number,
  ) {
    return this.hardwaresService.listarPontosEncaixeHardwarePublico(
      hardwarePaiId,
    );
  }

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  criar(@Body() dados: CriarHardwareDto) {
    return this.hardwaresService.criar(dados);
  }
}
