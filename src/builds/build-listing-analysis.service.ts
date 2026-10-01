import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CategoriaHardware } from '../generated/prisma/enums';
import { postProdutoIa } from '../ia/produto-ia-http';
import { PrismaService } from '../prisma/prisma.service';
import { AnalisarAnuncioBuildDto } from './dtos/analisar-anuncio-build.dto';

const CATEGORIAS_VINCULAVEIS: CategoriaHardware[] = [
  CategoriaHardware.PROCESSADOR,
  CategoriaHardware.PLACA_MAE,
  CategoriaHardware.MEMORIA_RAM,
  CategoriaHardware.PLACA_VIDEO,
  CategoriaHardware.ARMAZENAMENTO,
  CategoriaHardware.FONTE,
  CategoriaHardware.GABINETE,
  CategoriaHardware.COOLER,
  CategoriaHardware.VENTOINHA,
];

@Injectable()
export class BuildListingAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async analisar(dados: AnalisarAnuncioBuildDto): Promise<Record<string, unknown>> {
    const titulo = String(dados.titulo ?? '').trim();
    const descricao = String(dados.descricao ?? '').trim();
    if (!titulo && !descricao) {
      throw new BadRequestException('Informe o título ou a descrição original do anúncio.');
    }
    const baseUrl = process.env.PRODUTO_IA_URL?.trim();
    const key = process.env.PRODUTO_IA_API_KEY?.trim();
    if (!baseUrl || !key) {
      throw new ServiceUnavailableException('Configure PRODUTO_IA_URL e PRODUTO_IA_API_KEY para analisar o anúncio.');
    }

    // Restrição por tokens de modelo (B550M, 5600G, RTX 4060 etc.) para
    // procurar no catálogo sem transferir todos os hardwares à ProdutoIA.
    // Alguns cadastros antigos possuem o modelo completo somente em `nome`,
    // então consultamos os dois campos antes de enviar os candidatos à IA.
    const tokens = [...new Set(
      (titulo + ' ' + descricao).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().match(/\b[a-z0-9]{3,}\b/g) ?? [],
    )].filter((token) => /\d/.test(token) && !/^\d{1,2}$/.test(token)).slice(0, 35);
    const catalogo = tokens.length
      ? await this.prisma.hardware.findMany({
          where: {
            ativo: true,
            categoria: { in: CATEGORIAS_VINCULAVEIS },
            OR: tokens.flatMap((token) => [
              { modelo: { contains: token, mode: 'insensitive' as const } },
              { nome: { contains: token, mode: 'insensitive' as const } },
            ]),
          },
          select: { id: true, nome: true, marca: true, modelo: true, categoria: true },
          orderBy: { id: 'desc' },
          take: 500,
        })
      : [];

    // Apenas sugestão. O Admin precisa aceitar/corrigir cada vínculo antes de
    // cadastrar o PC; teclado, mouse e RAM genérica continuam na descrição.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const endpoint = `${baseUrl.replace(/\/+$/, '')}/anuncios/classificar-pc-kit`;
      const resposta = await postProdutoIa(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({ titulo, descricao, catalogo }),
        signal: controller.signal,
      });
      if (!resposta.ok) {
        throw new BadGatewayException(`ProjetoIA não conseguiu analisar o anúncio (HTTP ${resposta.status}).`);
      }
      const resultado: unknown = await resposta.json();
      if (!resultado || typeof resultado !== 'object' || Array.isArray(resultado)) {
        throw new BadGatewayException('ProjetoIA retornou uma prévia inválida.');
      }
      return { ...(resultado as Record<string, unknown>), origem: 'PROJETO_IA', catalogoConsultado: catalogo.length };
    } catch (erro) {
      if (erro instanceof BadGatewayException) throw erro;
      if (erro instanceof Error && erro.name === 'AbortError') {
        throw new BadGatewayException('Tempo esgotado na análise do anúncio pela ProjetoIA.');
      }
      throw new BadGatewayException('Não foi possível comunicar com a ProjetoIA para analisar o anúncio.');
    } finally {
      clearTimeout(timer);
    }
  }
}
