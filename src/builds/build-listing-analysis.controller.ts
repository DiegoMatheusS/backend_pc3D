import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { Papeis } from '../auth/papeis.decorator';
import { PapelGuard } from '../auth/papel.guard';
import { PapelUsuario } from '../generated/prisma/enums';
import { BuildListingAnalysisService } from './build-listing-analysis.service';
import { AnalisarAnuncioBuildDto } from './dtos/analisar-anuncio-build.dto';

@ApiTags('Analisar anúncio de PC ou kit (Admin)')
@Controller('admin/builds')
@UseGuards(AuthGuard, PapelGuard)
export class BuildListingAnalysisController {
  constructor(private readonly analysis: BuildListingAnalysisService) {}

  @Post('analisar-anuncio')
  @Papeis(PapelUsuario.ADMIN, PapelUsuario.EDITOR)
  @Throttle({ global: { limit: 15, ttl: 60_000 } })
  analisar(@Body() dados: AnalisarAnuncioBuildDto) {
    return this.analysis.analisar(dados);
  }
}
