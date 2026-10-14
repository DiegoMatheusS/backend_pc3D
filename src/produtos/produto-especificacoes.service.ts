import { BadRequestException, Injectable } from '@nestjs/common';
import { ProdutoIaPythonService } from '../ia/produto-ia-python.service';
import { CategoriaImportacaoIa } from '../ia/dtos/categoria-importacao-ia';
import { ProdutosService } from './produtos.service';
import { BuscarEspecificacoesProdutoDto } from './dtos/buscar-especificacoes-produto.dto';
import {
  especificacoesMetadados,
  preencherLacunas,
  registro,
  vazio,
} from './especificacoes-produto';

const FICHAS: Record<string, string> = {
  CELULAR: 'especificacaoCelular',
  MONITOR: 'especificacaoMonitor',
  MOUSE: 'especificacaoMouse',
  TECLADO: 'especificacaoTeclado',
  HEADSET: 'especificacaoHeadset',
  PROCESSADOR: 'especificacaoProcessador',
  PLACA_MAE: 'especificacaoPlacaMae',
  MEMORIA_RAM: 'especificacaoMemoriaRam',
  PLACA_VIDEO: 'especificacaoPlacaVideo',
  ARMAZENAMENTO: 'especificacaoArmazenamento',
  FONTE: 'especificacaoFonte',
  GABINETE: 'especificacaoGabinete',
  COOLER: 'especificacaoCooler',
  VENTOINHA: 'especificacaoVentoinha',
};
const CATEGORIAS: Record<string, CategoriaImportacaoIa> = {
  celulares: 'CELULAR',
  monitores: 'MONITOR',
  mouses: 'MOUSE',
  teclados: 'TECLADO',
  headsets: 'HEADSET',
  fones: 'FONE',
  microfones: 'MICROFONE',
  webcams: 'WEBCAM',
  mousepads: 'MOUSEPAD',
  cadeiras: 'CADEIRA',
  mesas: 'MESA',
  tablets: 'TABLET',
};

@Injectable()
export class ProdutoEspecificacoesService {
  constructor(
    private readonly produtos: ProdutosService,
    private readonly produtoIa: ProdutoIaPythonService,
  ) {}

  async buscar(produtoId: number, dados: BuscarEspecificacoesProdutoDto) {
    const produto = await this.produtos.buscarAdmin(produtoId);
    const categoria =
      produto.hardware?.categoria ?? CATEGORIAS[produto.categoria.slug];
    if (produto.notebook || produto.build) {
      throw new BadRequestException(
        'Use a ficha especializada deste produto para pesquisar especificações.',
      );
    }
    const campo = categoria ? FICHAS[categoria] : undefined;
    const alvo = registro(produto.hardware ?? produto);
    const atuais =
      campo && campo !== 'especificacaoCelular'
        ? registro(alvo[campo])
        : especificacoesMetadados(produto.metadados);
    const avisos: string[] = [];
    let encontradas: Record<string, unknown> = {};
    let origemPorCampo: Record<string, unknown> = {};
    let descricao = '';
    const fontes: string[] = [];

    // Usa as ofertas já vinculadas. Não cria produtos ou ofertas durante a busca.
    const urls = [
      ...new Set(
        produto.ofertas
          .filter((oferta) => oferta.status !== 'DESCONTINUADA')
          .map((oferta) => oferta.urlOriginal)
          .filter(Boolean),
      ),
    ].slice(0, 2);
    for (const url of urls) {
      try {
        const analise = await this.produtoIa.importarUrl(url, categoria, {
          enrich: false,
          detalharPagina: true,
        });
        if (
          categoria &&
          analise.categoriaDetectada &&
          analise.categoriaDetectada !== categoria
        ) {
          avisos.push('Uma fonte retornou outra categoria e foi ignorada.');
          continue;
        }
        const payload = registro(
          analise.cadastroSugerido?.payload ?? analise.payloadParcialBackend,
        );
        // Um código divergente identifica uma variante diferente.
        const divergente = ['gtin', 'mpn', 'modelo'].some((chave) => {
          const valorAtual = alvo[chave];
          const valorNovo = payload[chave];
          const atual = typeof valorAtual === 'string' ? valorAtual.trim().toLowerCase() : '';
          const novo = typeof valorNovo === 'string' ? valorNovo.trim().toLowerCase() : '';
          return atual && novo && atual !== novo;
        });
        if (divergente) {
          avisos.push(
            'Uma fonte retornou outro modelo ou variante e foi ignorada.',
          );
          continue;
        }
        const specs = registro(
          (campo && payload[campo]) || analise.especificacoesEncontradas,
        );
        const novas = preencherLacunas(encontradas, specs);
        for (const chave of Object.keys(novas)) {
          if (vazio(encontradas[chave]))
            origemPorCampo[chave] = {
              url,
              fonte: analise.fonte || 'PÁGINA DO PRODUTO',
            };
        }
        encontradas = novas;
        if (!descricao && typeof payload.descricao === 'string')
          descricao = payload.descricao;
        fontes.push(url);
      } catch {
        avisos.push(
          'Não foi possível ler uma das páginas vinculadas ao produto.',
        );
      }
    }

    let pesquisa: Record<string, unknown> = {};
    if (categoria && campo) {
      const seed = {
        nome: produto.nome,
        marca: alvo.marca ?? produto.marca,
        modelo: alvo.modelo ?? produto.modelo,
        mpn: alvo.mpn ?? produto.mpn,
        gtin: alvo.gtin ?? produto.gtin,
        [campo]: preencherLacunas(atuais, encontradas),
      };
      try {
        // O fluxo existente pesquisa fontes técnicas antes de usar a IA nas lacunas.
        pesquisa = await this.produtoIa.enriquecerIaTecnica({
          provedor: dados.usarIa === false ? 'PROJETO_IA' : 'OPENAI',
          categoria,
          nome: produto.nome,
          payload: seed,
          somentePreencheLacunas: true,
        });
        encontradas = preencherLacunas(
          encontradas,
          registro(registro(pesquisa.payload)[campo]),
        );
        origemPorCampo = {
          ...origemPorCampo,
          ...registro(pesquisa.origemPorCampo),
        };
      } catch {
        avisos.push(
          'A pesquisa complementar está indisponível. Os dados coletados nas páginas foram preservados.',
        );
      }
    } else if (dados.usarIa !== false) {
      avisos.push(
        'Esta categoria permite coletar dados das páginas; a pesquisa técnica com IA ainda não tem ficha definida.',
      );
    }
    const final = preencherLacunas(atuais, encontradas);
    const camposPreenchidos = Object.keys(final).filter(
      (chave) => vazio(atuais[chave]) && !vazio(final[chave]),
    );
    const especificacoes = Object.fromEntries(
      camposPreenchidos.map((chave) => [chave, final[chave]]),
    );
    return {
      produtoId,
      hardwareId: produto.hardware?.id ?? null,
      categoria,
      campoEspecificacao: campo ?? null,
      especificacoes,
      descricao: vazio(produto.descricao) ? descricao : '',
      camposPreenchidos,
      origemPorCampo: Object.fromEntries(
        camposPreenchidos.map((chave) => [chave, origemPorCampo[chave] ?? {}]),
      ),
      fontes,
      avisos,
      pesquisa,
      nenhumRegistroAlterado: true,
    };
  }
}
