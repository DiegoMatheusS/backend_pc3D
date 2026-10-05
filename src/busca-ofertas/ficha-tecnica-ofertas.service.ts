import { Injectable } from '@nestjs/common';
import { CategoriaHardware } from '../generated/prisma/enums';
import { HardwaresService } from '../hardwares/hardwares.service';
import { AtualizarHardwareDto } from '../hardwares/dtos/atualizar-hardware.dto';
import { ProdutoIaPythonService } from '../ia/produto-ia-python.service';
import { PrismaService } from '../prisma/prisma.service';

type Registro = Record<string, unknown>;

type ResultadoBuscaOfertas = {
  cadastradas?: Array<Record<string, unknown>>;
  ignoradas?: Array<Record<string, unknown>>;
  [chave: string]: unknown;
};

const CAMPO_ESPECIFICACAO: Partial<Record<CategoriaHardware, string>> = {
  [CategoriaHardware.PROCESSADOR]: 'especificacaoProcessador',
  [CategoriaHardware.PLACA_MAE]: 'especificacaoPlacaMae',
  [CategoriaHardware.MEMORIA_RAM]: 'especificacaoMemoriaRam',
  [CategoriaHardware.PLACA_VIDEO]: 'especificacaoPlacaVideo',
  [CategoriaHardware.ARMAZENAMENTO]: 'especificacaoArmazenamento',
  [CategoriaHardware.FONTE]: 'especificacaoFonte',
  [CategoriaHardware.GABINETE]: 'especificacaoGabinete',
  [CategoriaHardware.COOLER]: 'especificacaoCooler',
  [CategoriaHardware.VENTOINHA]: 'especificacaoVentoinha',
};

const CAMPOS_INTERNOS = new Set([
  'id',
  'hardwareId',
  'especificacaoPlacaMaeId',
  'especificacaoGabineteId',
  'criadoEm',
  'atualizadoEm',
]);

@Injectable()
export class FichaTecnicaOfertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly produtoIa: ProdutoIaPythonService,
    private readonly hardwaresService: HardwaresService,
  ) {}

  private registro(valor: unknown): Registro | null {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
      ? (valor as Registro)
      : null;
  }

  private vazio(valor: unknown): boolean {
    return (
      valor === null ||
      valor === undefined ||
      (typeof valor === 'string' && !valor.trim()) ||
      (Array.isArray(valor) && valor.length === 0)
    );
  }

  private limparMetadados(valor: unknown): unknown {
    if (Array.isArray(valor)) {
      return valor.map((item) => this.limparMetadados(item));
    }
    const objeto = this.registro(valor);
    if (!objeto) return valor;

    return Object.fromEntries(
      Object.entries(objeto)
        .filter(([chave]) => !CAMPOS_INTERNOS.has(chave))
        .map(([chave, item]) => [chave, this.limparMetadados(item)]),
    );
  }

  private mesclarSomenteLacunas(
    atual: unknown,
    novo: unknown,
    caminho = '',
  ): { valor: unknown; camposPreenchidos: string[] } {
    if (this.vazio(atual) && !this.vazio(novo)) {
      return {
        valor: this.limparMetadados(novo),
        camposPreenchidos: caminho ? [caminho] : [],
      };
    }

    const atualObj = this.registro(atual);
    const novoObj = this.registro(novo);
    if (!atualObj || !novoObj) {
      return { valor: atual, camposPreenchidos: [] };
    }

    const resultado: Registro = { ...atualObj };
    const preenchidos: string[] = [];
    for (const [chave, valorNovo] of Object.entries(novoObj)) {
      if (CAMPOS_INTERNOS.has(chave)) continue;
      const subcaminho = caminho ? `${caminho}.${chave}` : chave;
      const mescla = this.mesclarSomenteLacunas(
        atualObj[chave],
        valorNovo,
        subcaminho,
      );
      resultado[chave] = mescla.valor;
      preenchidos.push(...mescla.camposPreenchidos);
    }

    return {
      valor: this.limparMetadados(resultado),
      camposPreenchidos: preenchidos,
    };
  }

  private urlParaEnriquecimento(resultado: ResultadoBuscaOfertas): string | null {
    for (const item of resultado.cadastradas ?? []) {
      const url = String(item.urlOriginal ?? '').trim();
      if (url) return url;
    }
    for (const item of resultado.ignoradas ?? []) {
      if (item.motivo !== 'JA_CADASTRADA') continue;
      const url = String(item.urlOriginal ?? '').trim();
      if (url) return url;
    }
    return null;
  }

  async enriquecer(
    produtoId: number,
    resultadoBusca: ResultadoBuscaOfertas,
  ): Promise<Record<string, unknown>> {
    const produto = await this.prisma.produto.findFirst({
      where: { id: produtoId, ativo: true },
      select: {
        id: true,
        nome: true,
        hardware: { select: { id: true, categoria: true } },
      },
    });

    if (!produto?.hardware) {
      return {
        fichaTecnicaAlterada: false,
        fichaTecnicaMotivo: 'PRODUTO_SEM_HARDWARE_VINCULADO',
        camposFichaTecnicaPreenchidos: [],
      };
    }

    const campoEspecificacao = CAMPO_ESPECIFICACAO[produto.hardware.categoria];
    if (!campoEspecificacao) {
      return {
        fichaTecnicaAlterada: false,
        fichaTecnicaMotivo: 'CATEGORIA_SEM_FICHA_ESTRUTURADA',
        camposFichaTecnicaPreenchidos: [],
      };
    }

    const url = this.urlParaEnriquecimento(resultadoBusca);
    if (!url) {
      return {
        fichaTecnicaAlterada: false,
        fichaTecnicaMotivo: 'NENHUMA_OFERTA_CONFIRMADA_PARA_ENRIQUECER',
        camposFichaTecnicaPreenchidos: [],
      };
    }

    try {
      const hardwareAtual = await this.hardwaresService.buscarPorIdAdmin(
        produto.hardware.id,
      );
      const hardwareRegistro = hardwareAtual as unknown as Registro;
      const especificacaoAtual = this.limparMetadados(
        hardwareRegistro[campoEspecificacao],
      );

      const analise = await this.produtoIa.importarUrl(
        url,
        produto.hardware.categoria,
        {
          enrich: true,
          noBrowser: false,
          detalharPagina: true,
        },
      );

      const payload =
        this.registro(analise.cadastroSugerido?.payload) ??
        this.registro(analise.payloadParcialBackend) ??
        {};
      const especificacaoEncontrada =
        this.registro(payload[campoEspecificacao]) ??
        this.registro(analise.especificacoesEncontradas);

      if (!especificacaoEncontrada) {
        return {
          fichaTecnicaAlterada: false,
          fichaTecnicaMotivo: 'PRODUTO_IA_NAO_RETORNOU_ESPECIFICACOES',
          camposFichaTecnicaPreenchidos: [],
          fichaTecnicaFonteUrl: url,
        };
      }

      if (
        !especificacaoAtual &&
        analise.cadastroSugerido?.prontoParaCadastrar === false
      ) {
        return {
          fichaTecnicaAlterada: false,
          fichaTecnicaMotivo: 'FICHA_NOVA_INCOMPLETA_NAO_APLICADA',
          camposFichaTecnicaPreenchidos: [],
          camposObrigatoriosAusentes:
            analise.cadastroSugerido?.camposObrigatoriosAusentes ?? [],
          fichaTecnicaFonteUrl: url,
        };
      }

      const mescla = this.mesclarSomenteLacunas(
        especificacaoAtual ?? {},
        especificacaoEncontrada,
      );
      if (mescla.camposPreenchidos.length === 0) {
        return {
          fichaTecnicaAlterada: false,
          fichaTecnicaMotivo: 'SEM_LACUNAS_CONFIRMADAS_PARA_PREENCHER',
          camposFichaTecnicaPreenchidos: [],
          fichaTecnicaFonteUrl: url,
        };
      }

      await this.hardwaresService.atualizar(
        produto.hardware.id,
        {
          [campoEspecificacao]: mescla.valor,
        } as AtualizarHardwareDto,
      );

      return {
        fichaTecnicaAlterada: true,
        fichaTecnicaMotivo: 'LACUNAS_PREENCHIDAS_COM_PRODUTO_IA',
        camposFichaTecnicaPreenchidos: mescla.camposPreenchidos,
        fichaTecnicaFonteUrl: url,
        fichaTecnicaSomentePreencheLacunas: true,
      };
    } catch (erro) {
      return {
        fichaTecnicaAlterada: false,
        fichaTecnicaMotivo: 'ENRIQUECIMENTO_FALHOU_SEM_CANCELAR_OFERTAS',
        camposFichaTecnicaPreenchidos: [],
        fichaTecnicaFonteUrl: url,
        fichaTecnicaErro:
          erro instanceof Error ? erro.message : 'Erro desconhecido.',
      };
    }
  }
}
