import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HardwaresDescobertaIaService } from '../hardwares-descoberta-ia/hardwares-descoberta-ia.service';
import { HardwaresService } from '../hardwares/hardwares.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { ProdutosService } from '../produtos/produtos.service';
import {
  ImportarOfertaExtensaoProdutoIaDto,
  OfertaExtensaoDto,
  ParceiroOfertaExtensaoDto,
  ProdutoOfertaExtensaoDto,
} from './dtos/importar-oferta-extensao-produto-ia.dto';

type Registro = Record<string, unknown>;

@Injectable()
export class ProdutoIaIntegracaoInternaService {
  constructor(
    private readonly descobertaHardware: HardwaresDescobertaIaService,
    private readonly hardwaresService: HardwaresService,
    private readonly ofertasService: OfertasService,
    private readonly produtosService: ProdutosService,
  ) {}

  private normalizar(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '')
      .trim();
  }

  private urlCanonica(valor: unknown): string {
    try {
      const url = new URL(String(valor ?? '').trim());
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      const path = url.pathname.replace(/\/+$/u, '') || '/';
      return `${url.protocol}//${url.host.toLowerCase()}${path}`;
    } catch {
      return '';
    }
  }

  private idHardwareOferta(oferta: Registro): number | null {
    if (typeof oferta.hardwareId === 'number') return oferta.hardwareId;
    const hardware = oferta.hardware;
    if (
      hardware &&
      typeof hardware === 'object' &&
      !Array.isArray(hardware) &&
      typeof (hardware as Registro).id === 'number'
    ) {
      return (hardware as Registro).id as number;
    }
    return null;
  }

  private idProdutoOferta(oferta: Registro): number | null {
    if (typeof oferta.produtoId === 'number') return oferta.produtoId;
    const produto = oferta.produto;
    if (
      produto &&
      typeof produto === 'object' &&
      !Array.isArray(produto) &&
      typeof (produto as Registro).id === 'number'
    ) {
      return (produto as Registro).id as number;
    }
    return null;
  }

  private idParceiroOferta(oferta: Registro): number | null {
    if (typeof oferta.parceiroId === 'number') return oferta.parceiroId;
    const parceiro = oferta.parceiro;
    if (
      parceiro &&
      typeof parceiro === 'object' &&
      !Array.isArray(parceiro) &&
      typeof (parceiro as Registro).id === 'number'
    ) {
      return (parceiro as Registro).id as number;
    }
    return null;
  }

  private mesmaPublicacao(
    oferta: Registro,
    parceiroId: number,
    urlOriginal: string,
    codigoMarketplace?: string | null,
  ): boolean {
    if (this.idParceiroOferta(oferta) !== parceiroId) return false;

    const codigoAtual = this.normalizar(oferta.codigoMarketplace);
    const codigoNovo = this.normalizar(codigoMarketplace);
    if (codigoAtual && codigoNovo && codigoAtual === codigoNovo) return true;

    const atual = this.urlCanonica(oferta.urlOriginal);
    const nova = this.urlCanonica(urlOriginal);
    return Boolean(atual && nova && atual === nova);
  }

  private mesmaOfertaHardware(
    oferta: Registro,
    hardwareId: number,
    parceiroId: number,
    urlOriginal: string,
    codigoMarketplace?: string | null,
  ): boolean {
    return (
      this.idHardwareOferta(oferta) === hardwareId &&
      this.mesmaPublicacao(
        oferta,
        parceiroId,
        urlOriginal,
        codigoMarketplace,
      )
    );
  }

  private categoriaIdProduto(produto: Registro): number | null {
    if (typeof produto.categoriaId === 'number') return produto.categoriaId;
    const categoria = produto.categoria;
    if (
      categoria &&
      typeof categoria === 'object' &&
      !Array.isArray(categoria) &&
      typeof (categoria as Registro).id === 'number'
    ) {
      return (categoria as Registro).id as number;
    }
    return null;
  }

  private mesmoProdutoGenerico(
    produto: Registro,
    categoriaId: number,
    dados: ProdutoOfertaExtensaoDto,
  ): boolean {
    if (this.normalizar(produto.tipo) !== 'generico') return false;
    if (this.categoriaIdProduto(produto) !== categoriaId) return false;

    const mpnAtual = this.normalizar(produto.mpn);
    const mpnNovo = this.normalizar(dados.mpn);
    if (mpnAtual && mpnNovo && mpnAtual === mpnNovo) return true;

    const gtinAtual = this.normalizar(produto.gtin);
    const gtinNovo = this.normalizar(dados.gtin);
    if (gtinAtual && gtinNovo && gtinAtual === gtinNovo) return true;

    const marcaAtual = this.normalizar(produto.marca);
    const marcaNova = this.normalizar(dados.marca);
    const modeloAtual = this.normalizar(produto.modelo);
    const modeloNovo = this.normalizar(dados.modelo);
    return Boolean(
      marcaAtual &&
        marcaNova &&
        modeloAtual &&
        modeloNovo &&
        marcaAtual === marcaNova &&
        modeloAtual === modeloNovo,
    );
  }

  private publicarProdutoExistente(
    produtoId: number,
    dados: ProdutoOfertaExtensaoDto,
  ) {
    const { categoriaSlug: _categoriaSlug, ...atualizacao } = dados;
    void _categoriaSlug;
    return this.produtosService.atualizar(produtoId, {
      ...atualizacao,
      publicado: true,
      ativo: true,
    });
  }

  private async resolverParceiro(dados: ParceiroOfertaExtensaoDto) {
    const parceirosResultado = await this.ofertasService.listarParceiros();
    const nomeParceiro = this.normalizar(dados.nome);
    const dominioParceiro = this.normalizar(dados.dominio);

    const parceiroEncontrado = parceirosResultado.parceiros.find((item) => {
      const mesmoNome = this.normalizar(item.nome) === nomeParceiro;
      const mesmoDominio =
        Boolean(dominioParceiro) &&
        this.normalizar(item.dominio) === dominioParceiro;
      return mesmoNome || mesmoDominio;
    });

    if (parceiroEncontrado?.ativo === false) {
      throw new ConflictException(
        `O parceiro "${parceiroEncontrado.nome}" existe, mas está desativado no Criabyte.`,
      );
    }

    if (parceiroEncontrado) {
      return {
        id: parceiroEncontrado.id,
        nome: parceiroEncontrado.nome,
      };
    }

    const criado = await this.ofertasService.criarParceiro({
      nome: dados.nome,
      dominio: dados.dominio ?? null,
      site: dados.site ?? null,
      programaAfiliados: true,
      observacao:
        'Criado automaticamente pela integração interna da extensão Criabyte.',
    });
    return { id: criado.id, nome: criado.nome };
  }

  private ofertaBase(parceiroId: number, dados: OfertaExtensaoDto) {
    return {
      parceiroId,
      urlOriginal: dados.urlOriginal,
      urlAfiliada: dados.urlAfiliada,
      preco: dados.preco,
      ...(dados.precoAnterior !== undefined && {
        precoAnterior: dados.precoAnterior,
      }),
      ...(dados.codigoMarketplace && {
        codigoMarketplace: dados.codigoMarketplace,
      }),
      ...(dados.vendedorNome && {
        vendedorNome: dados.vendedorNome,
      }),
      ...(dados.vendedorIdentificador && {
        vendedorIdentificador: dados.vendedorIdentificador,
      }),
    };
  }

  private atualizarOferta(id: number, dados: OfertaExtensaoDto) {
    return this.ofertasService.atualizarOferta(id, {
      urlOriginal: dados.urlOriginal,
      urlAfiliada: dados.urlAfiliada,
      preco: dados.preco,
      precoAnterior: dados.precoAnterior ?? undefined,
      codigoMarketplace: dados.codigoMarketplace ?? undefined,
      vendedorNome: dados.vendedorNome ?? undefined,
      vendedorIdentificador: dados.vendedorIdentificador ?? undefined,
    });
  }

  private async importarProdutoExtensao(
    dados: ImportarOfertaExtensaoProdutoIaDto,
  ) {
    const produtoPayload = dados.produtoPayload!;
    const parceiro = await this.resolverParceiro(dados.parceiro);
    const ofertasResultado = await this.ofertasService.listarOfertas();

    // O mesmo anúncio deve ser idempotente mesmo quando a primeira coleta não
    // trouxe MPN/GTIN/modelo suficiente para reencontrar o Produto por identidade.
    const anuncioExistente = ofertasResultado.ofertas.find((item) =>
      this.mesmaPublicacao(
        item as unknown as Registro,
        parceiro.id,
        dados.oferta.urlOriginal,
        dados.oferta.codigoMarketplace,
      ),
    );

    if (anuncioExistente) {
      const produtoId = this.idProdutoOferta(
        anuncioExistente as unknown as Registro,
      );
      if (produtoId) {
        const produto = await this.publicarProdutoExistente(
          produtoId,
          produtoPayload,
        );
        const atualizada = await this.atualizarOferta(
          anuncioExistente.id,
          dados.oferta,
        );
        return {
          status: 'OFERTA_ATUALIZADA' as const,
          produto: { id: produto.id, nome: produto.nome },
          parceiro: { id: parceiro.id, nome: parceiro.nome },
          publicado: true,
          oferta: atualizada,
        };
      }
    }

    const slugCategoria = produtoPayload.categoriaSlug.trim().toLowerCase();
    const categorias = await this.produtosService.listarCategoriasAdmin();
    const categoria = categorias.find(
      (item) => item.ativo && item.slug.toLowerCase() === slugCategoria,
    );
    if (!categoria) {
      throw new NotFoundException(
        `Categoria comercial "${slugCategoria}" não encontrada ou inativa.`,
      );
    }

    const produtos = await this.produtosService.listarAdmin();
    const produtoExistente = produtos.find((item) =>
      this.mesmoProdutoGenerico(
        item as unknown as Registro,
        categoria.id,
        produtoPayload,
      ),
    );

    const ofertaBase = this.ofertaBase(parceiro.id, dados.oferta);
    if (produtoExistente) {
      const produtoAtualizado = await this.publicarProdutoExistente(
        produtoExistente.id,
        produtoPayload,
      );
      const oferta = await this.ofertasService.criarOferta({
        ...ofertaBase,
        produtoId: produtoExistente.id,
      });
      return {
        status: 'NOVA_OFERTA_CRIADA' as const,
        produto: { id: produtoAtualizado.id, nome: produtoAtualizado.nome },
        parceiro: { id: parceiro.id, nome: parceiro.nome },
        publicado: true,
        oferta,
      };
    }

    const {
      categoriaSlug: _categoriaSlug,
      ...dadosProduto
    } = produtoPayload;
    void _categoriaSlug;

    const produto = await this.produtosService.criar({
      ...dadosProduto,
      categoriaId: categoria.id,
      publicado: true,
      ativo: true,
      ofertaInicial: ofertaBase,
    });

    return {
      status: 'PRODUTO_E_OFERTA_CRIADOS' as const,
      produto: { id: produto.id, nome: produto.nome },
      parceiro: { id: parceiro.id, nome: parceiro.nome },
      publicado: true,
      oferta: produto.ofertas?.[0] ?? null,
      observacao: 'Novo Produto criado e publicado automaticamente pela extensão.',
    };
  }

  private async importarHardwareExtensao(
    dados: ImportarOfertaExtensaoProdutoIaDto,
  ) {
    const registroHardware = await this.descobertaHardware.cadastrar({
      payload: dados.hardwarePayload!,
    });

    const hardwareId = registroHardware.hardware.id;
    const hardware = await this.hardwaresService.buscarPorIdAdmin(hardwareId);
    if (hardware.produtoId) {
      await this.produtosService.atualizar(hardware.produtoId, {
        publicado: true,
        ativo: true,
      });
    }

    const parceiro = await this.resolverParceiro(dados.parceiro);
    const ofertasResultado = await this.ofertasService.listarOfertas();
    const existente = ofertasResultado.ofertas.find((item) =>
      this.mesmaOfertaHardware(
        item as unknown as Registro,
        hardwareId,
        parceiro.id,
        dados.oferta.urlOriginal,
        dados.oferta.codigoMarketplace,
      ),
    );

    if (existente) {
      const atualizada = await this.atualizarOferta(existente.id, dados.oferta);
      return {
        status: 'OFERTA_ATUALIZADA' as const,
        hardwareStatus: registroHardware.status,
        hardware: { id: hardwareId, nome: hardware.nome },
        parceiro: { id: parceiro.id, nome: parceiro.nome },
        publicado: true,
        oferta: atualizada,
      };
    }

    const ofertaBase = this.ofertaBase(parceiro.id, dados.oferta);
    if (hardware.produtoId) {
      const oferta = await this.ofertasService.criarOferta({
        ...ofertaBase,
        hardwareId,
      });
      return {
        status: 'NOVA_OFERTA_CRIADA' as const,
        hardwareStatus: registroHardware.status,
        hardware: { id: hardwareId, nome: hardware.nome },
        parceiro: { id: parceiro.id, nome: parceiro.nome },
        publicado: true,
        oferta,
      };
    }

    const produto = await this.produtosService.criarDeHardware(hardwareId, {
      publicado: true,
      ativo: true,
      ofertaInicial: ofertaBase,
    });

    return {
      status: 'HARDWARE_E_OFERTA_CRIADOS' as const,
      hardwareStatus: registroHardware.status,
      hardware: { id: hardwareId, nome: hardware.nome },
      parceiro: { id: parceiro.id, nome: parceiro.nome },
      produto,
      publicado: true,
      observacao: 'Novo Hardware/Produto criado e publicado automaticamente pela extensão.',
    };
  }

  async importarOfertaExtensao(dados: ImportarOfertaExtensaoProdutoIaDto) {
    const possuiHardware = Boolean(dados.hardwarePayload);
    const possuiProduto = Boolean(dados.produtoPayload);
    if (possuiHardware === possuiProduto) {
      throw new BadRequestException(
        'Informe exatamente um destino de cadastro: hardwarePayload ou produtoPayload.',
      );
    }

    if (possuiProduto) {
      return this.importarProdutoExtensao(dados);
    }
    return this.importarHardwareExtensao(dados);
  }
}
