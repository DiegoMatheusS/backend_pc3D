import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HardwaresDescobertaIaService } from '../hardwares-descoberta-ia/hardwares-descoberta-ia.service';
import { HardwaresService } from '../hardwares/hardwares.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { mesmaPublicacaoMarketplace } from '../ofertas/utils/identidade-publicacao';
import { ProdutosService } from '../produtos/produtos.service';
import { BuildsCatalogoService } from '../builds/builds-catalogo.service';
import { sameCatalogIdentity } from '../common/catalog-identity';
import { BuscarItemExtensaoProdutoIaDto } from './dtos/buscar-item-extensao-produto-ia.dto';
import {
  ImportarOfertaExtensaoProdutoIaDto,
  OfertaExtensaoDto,
  ParceiroOfertaExtensaoDto,
  ProdutoOfertaExtensaoDto,
} from './dtos/importar-oferta-extensao-produto-ia.dto';

type Registro = Record<string, unknown>;
type CriterioBusca = 'ASIN' | 'GTIN' | 'MPN' | 'MARCA_MODELO' | 'NOME_MARCA';

@Injectable()
export class ProdutoIaIntegracaoInternaService {
  constructor(
    private readonly descobertaHardware: HardwaresDescobertaIaService,
    private readonly hardwaresService: HardwaresService,
    private readonly ofertasService: OfertasService,
    private readonly produtosService: ProdutosService,
    private readonly buildsCatalogoService: BuildsCatalogoService,
  ) {}

  private normalizar(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '')
      .trim();
  }

  private metadados(valor: unknown): Registro {
    return valor && typeof valor === 'object' && !Array.isArray(valor)
      ? (valor as Registro)
      : {};
  }

  private asinProduto(produto: Registro): string {
    return this.normalizar(this.metadados(produto.metadados).asin);
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

  private codigoOferta(dados: OfertaExtensaoDto): string | null {
    return (
      dados.codigoMarketplace?.trim() ||
      dados.asin?.trim().toUpperCase() ||
      null
    );
  }

  private mesmaPublicacao(
    oferta: Registro,
    parceiroId: number,
    urlOriginal: string,
    codigoMarketplace?: string | null,
    vendedorIdentificador?: string | null,
  ): boolean {
    if (this.idParceiroOferta(oferta) !== parceiroId) return false;
    return mesmaPublicacaoMarketplace(oferta, {
      urlOriginal,
      codigoMarketplace,
      vendedorIdentificador,
    });
  }

  private mesmaOfertaHardware(
    oferta: Registro,
    hardwareId: number,
    parceiroId: number,
    urlOriginal: string,
    codigoMarketplace?: string | null,
    vendedorIdentificador?: string | null,
  ): boolean {
    return (
      this.idHardwareOferta(oferta) === hardwareId &&
      this.mesmaPublicacao(
        oferta,
        parceiroId,
        urlOriginal,
        codigoMarketplace,
        vendedorIdentificador,
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

    const asinAtual = this.asinProduto(produto);
    const asinNovo = this.normalizar(dados.asin);
    if (asinAtual && asinNovo && asinAtual === asinNovo) return true;

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

  private async publicarProdutoExistente(produtoId: number) {
    return this.produtosService.atualizar(produtoId, {
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
      return { id: parceiroEncontrado.id, nome: parceiroEncontrado.nome };
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
    const codigoMarketplace = this.codigoOferta(dados);
    return {
      parceiroId,
      urlOriginal: dados.urlOriginal,
      urlAfiliada: dados.urlAfiliada,
      preco: dados.preco,
      ...(dados.precoAnterior !== undefined && {
        precoAnterior: dados.precoAnterior,
      }),
      ...(codigoMarketplace && { codigoMarketplace }),
      ...(dados.vendedorNome && { vendedorNome: dados.vendedorNome }),
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
      codigoMarketplace: this.codigoOferta(dados) ?? undefined,
      vendedorNome: dados.vendedorNome ?? undefined,
      vendedorIdentificador: dados.vendedorIdentificador ?? undefined,
    });
  }

  private criterioRegistro(
    registro: Registro,
    dados: BuscarItemExtensaoProdutoIaDto,
  ): CriterioBusca | null {
    const asin = this.normalizar(dados.asin);
    if (asin && this.asinProduto(registro) === asin) return 'ASIN';

    const gtin = this.normalizar(dados.gtin);
    if (gtin && this.normalizar(registro.gtin) === gtin) return 'GTIN';

    const mpn = this.normalizar(dados.mpn);
    if (mpn && this.normalizar(registro.mpn) === mpn) return 'MPN';

    const marca = this.normalizar(dados.marca);
    const modelo = this.normalizar(dados.modelo);
    if (
      marca &&
      modelo &&
      this.normalizar(registro.marca) === marca &&
      this.normalizar(registro.modelo) === modelo
    )
      return 'MARCA_MODELO';

    const nome = this.normalizar(dados.nome);
    if (
      nome &&
      marca &&
      this.normalizar(registro.nome) === nome &&
      this.normalizar(registro.marca) === marca
    )
      return 'NOME_MARCA';

    return null;
  }

  async buscarItemExtensao(dados: BuscarItemExtensaoProdutoIaDto) {
    const temIdentidade = [
      dados.asin,
      dados.gtin,
      dados.mpn,
      dados.modelo,
      dados.nome,
    ].some((item) => this.normalizar(item));
    if (!temIdentidade) {
      return { status: 'DADOS_INSUFICIENTES' as const };
    }

    const produtos = await this.produtosService.listarAdmin();
    const candidatosProduto = produtos
      .map((produto) => ({
        produto,
        criterio: this.criterioRegistro(produto as unknown as Registro, dados),
      }))
      .filter((item) => item.criterio !== null);

    const prioridade: Record<CriterioBusca, number> = {
      ASIN: 5,
      GTIN: 4,
      MPN: 3,
      MARCA_MODELO: 2,
      NOME_MARCA: 1,
    };

    candidatosProduto.sort(
      (a, b) => prioridade[b.criterio!] - prioridade[a.criterio!],
    );
    if (candidatosProduto.length) {
      const melhor = candidatosProduto[0];
      const mesmaPrioridade = candidatosProduto.filter(
        (item) => prioridade[item.criterio!] === prioridade[melhor.criterio!],
      );
      if (mesmaPrioridade.length > 1 && melhor.criterio === 'NOME_MARCA') {
        return {
          status: 'AMBIGUO' as const,
          candidatos: mesmaPrioridade.slice(0, 5).map(({ produto }) => ({
            tipo: 'PRODUTO',
            id: produto.id,
            nome: produto.nome,
          })),
        };
      }
      return {
        status: 'EXISTENTE' as const,
        tipo: 'PRODUTO' as const,
        produtoId: melhor.produto.id,
        criterio: melhor.criterio,
        item: {
          id: melhor.produto.id,
          nome: melhor.produto.nome,
          marca: melhor.produto.marca,
          modelo: melhor.produto.modelo,
          gtin: melhor.produto.gtin,
          mpn: melhor.produto.mpn,
          asin:
            this.metadados((melhor.produto as unknown as Registro).metadados)
              .asin ?? null,
          publicado: melhor.produto.publicado,
        },
      };
    }

    const hardwares = await this.hardwaresService.listarTodos();
    const candidatosHardware = hardwares
      .map((hardware) => ({
        hardware,
        criterio: this.criterioRegistro(hardware as unknown as Registro, {
          ...dados,
          asin: undefined,
        }),
      }))
      .filter((item) => item.criterio !== null)
      .sort((a, b) => prioridade[b.criterio!] - prioridade[a.criterio!]);

    if (candidatosHardware.length) {
      const melhor = candidatosHardware[0];
      const mesmaPrioridade = candidatosHardware.filter(
        (item) => prioridade[item.criterio!] === prioridade[melhor.criterio!],
      );
      if (mesmaPrioridade.length > 1 && melhor.criterio === 'NOME_MARCA') {
        return {
          status: 'AMBIGUO' as const,
          candidatos: mesmaPrioridade.slice(0, 5).map(({ hardware }) => ({
            tipo: 'HARDWARE',
            id: hardware.id,
            nome: hardware.nome,
          })),
        };
      }
      return {
        status: 'EXISTENTE' as const,
        tipo: 'HARDWARE' as const,
        hardwareId: melhor.hardware.id,
        produtoId: melhor.hardware.produtoId ?? null,
        criterio: melhor.criterio,
        item: {
          id: melhor.hardware.id,
          nome: melhor.hardware.nome,
          marca: melhor.hardware.marca,
          modelo: melhor.hardware.modelo,
          gtin: melhor.hardware.gtin,
          mpn: melhor.hardware.mpn,
          publicado: melhor.hardware.publicado,
        },
      };
    }

    return { status: 'NAO_ENCONTRADO' as const };
  }

  private async importarExistenteExtensao(
    dados: ImportarOfertaExtensaoProdutoIaDto,
  ) {
    const parceiro = await this.resolverParceiro(dados.parceiro);
    const ofertasResultado = await this.ofertasService.listarOfertas();
    const codigoMarketplace = this.codigoOferta(dados.oferta);

    if (dados.produtoExistenteId) {
      const produto = await this.publicarProdutoExistente(
        dados.produtoExistenteId,
      );
      const existente = ofertasResultado.ofertas.find(
        (item) =>
          this.idProdutoOferta(item as unknown as Registro) ===
            dados.produtoExistenteId &&
          this.mesmaPublicacao(
            item as unknown as Registro,
            parceiro.id,
            dados.oferta.urlOriginal,
            codigoMarketplace,
            dados.oferta.vendedorIdentificador,
          ),
      );
      const oferta = existente
        ? await this.atualizarOferta(existente.id, dados.oferta)
        : await this.ofertasService.criarOferta({
            ...this.ofertaBase(parceiro.id, dados.oferta),
            produtoId: dados.produtoExistenteId,
          });
      return {
        status: existente
          ? ('OFERTA_ATUALIZADA' as const)
          : ('ITEM_EXISTENTE_OFERTA_CRIADA' as const),
        produto: { id: produto.id, nome: produto.nome },
        parceiro,
        publicado: true,
        oferta,
        completouComIa: false,
      };
    }

    const hardwareId = dados.hardwareExistenteId!;
    const hardware = await this.hardwaresService.buscarPorIdAdmin(hardwareId);
    if (hardware.produtoId) {
      await this.publicarProdutoExistente(hardware.produtoId);
    }
    const existente = ofertasResultado.ofertas.find((item) =>
      this.mesmaOfertaHardware(
        item as unknown as Registro,
        hardwareId,
        parceiro.id,
        dados.oferta.urlOriginal,
        codigoMarketplace,
        dados.oferta.vendedorIdentificador,
      ),
    );
    if (existente) {
      return {
        status: 'OFERTA_ATUALIZADA' as const,
        hardware: { id: hardware.id, nome: hardware.nome },
        parceiro,
        publicado: true,
        oferta: await this.atualizarOferta(existente.id, dados.oferta),
        completouComIa: false,
      };
    }

    if (hardware.produtoId) {
      const oferta = await this.ofertasService.criarOferta({
        ...this.ofertaBase(parceiro.id, dados.oferta),
        hardwareId,
      });
      return {
        status: 'ITEM_EXISTENTE_OFERTA_CRIADA' as const,
        hardware: { id: hardware.id, nome: hardware.nome },
        parceiro,
        publicado: true,
        oferta,
        completouComIa: false,
      };
    }

    const produto = await this.produtosService.criarDeHardware(hardwareId, {
      publicado: true,
      ativo: true,
      ofertaInicial: this.ofertaBase(parceiro.id, dados.oferta),
    });
    return {
      status: 'ITEM_EXISTENTE_OFERTA_CRIADA' as const,
      hardware: { id: hardware.id, nome: hardware.nome },
      produto: { id: produto.id, nome: produto.nome },
      parceiro,
      publicado: true,
      oferta: produto.ofertas?.[0] ?? null,
      completouComIa: false,
    };
  }

  private async importarProdutoExtensao(
    dados: ImportarOfertaExtensaoProdutoIaDto,
  ) {
    const produtoPayload = dados.produtoPayload!;
    const parceiro = await this.resolverParceiro(dados.parceiro);
    const ofertasResultado = await this.ofertasService.listarOfertas();
    const codigoMarketplace = this.codigoOferta(dados.oferta);

    const anuncioExistente = ofertasResultado.ofertas.find((item) =>
      this.mesmaPublicacao(
        item as unknown as Registro,
        parceiro.id,
        dados.oferta.urlOriginal,
        codigoMarketplace,
        dados.oferta.vendedorIdentificador,
      ),
    );

    if (anuncioExistente) {
      const produtoId = this.idProdutoOferta(
        anuncioExistente as unknown as Registro,
      );
      if (produtoId) {
        const produto = await this.publicarProdutoExistente(produtoId);
        const atualizada = await this.atualizarOferta(
          anuncioExistente.id,
          dados.oferta,
        );
        return {
          status: 'OFERTA_ATUALIZADA' as const,
          produto: { id: produto.id, nome: produto.nome },
          parceiro,
          publicado: true,
          oferta: atualizada,
          completouComIa: true,
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
      );
      const oferta = await this.ofertasService.criarOferta({
        ...ofertaBase,
        produtoId: produtoExistente.id,
      });
      return {
        status: 'NOVA_OFERTA_CRIADA' as const,
        produto: { id: produtoAtualizado.id, nome: produtoAtualizado.nome },
        parceiro,
        publicado: true,
        oferta,
        completouComIa: true,
      };
    }

    const {
      categoriaSlug: _categoriaSlug,
      asin,
      metadados,
      ...dadosProduto
    } = produtoPayload;
    void _categoriaSlug;

    const produto = await this.produtosService.criar({
      ...dadosProduto,
      ...(metadados || asin
        ? {
            metadados: {
              ...(metadados ?? {}),
              ...(asin ? { asin: asin.trim().toUpperCase() } : {}),
            },
          }
        : {}),
      categoriaId: categoria.id,
      publicado: true,
      ativo: true,
      ofertaInicial: ofertaBase,
    });

    return {
      status: 'PRODUTO_E_OFERTA_CRIADOS' as const,
      produto: { id: produto.id, nome: produto.nome },
      parceiro,
      publicado: true,
      oferta: produto.ofertas?.[0] ?? null,
      completouComIa: true,
      observacao:
        'Novo Produto criado e publicado automaticamente pela extensão.',
    };
  }

  private async importarBuildExtensao(
    dados: ImportarOfertaExtensaoProdutoIaDto,
  ) {
    const buildPayload = dados.buildPayload;
    if (!buildPayload) throw new BadRequestException('Informe o PC montado.');
    if (!buildPayload.descricao?.trim()) {
      throw new BadRequestException(
        'Informe a descrição do anúncio do PC montado.',
      );
    }
    const parceiro = await this.resolverParceiro(dados.parceiro);
    const ofertasResultado = await this.ofertasService.listarOfertas();
    const produtos = await this.produtosService.listarAdmin();
    const anuncioExistente = ofertasResultado.ofertas.find((item) =>
      this.mesmaPublicacao(
        item as unknown as Registro,
        parceiro.id,
        dados.oferta.urlOriginal,
        this.codigoOferta(dados.oferta),
        dados.oferta.vendedorIdentificador,
      ),
    );
    const produtoAnuncioId = anuncioExistente
      ? this.idProdutoOferta(anuncioExistente)
      : null;
    const produtoAnuncio = produtos.find(
      (item) => item.id === produtoAnuncioId,
    );
    if (
      anuncioExistente &&
      (!produtoAnuncio || produtoAnuncio.tipo !== 'BUILD')
    ) {
      throw new ConflictException(
        'Este anúncio já está vinculado a outro tipo de Produto. Revise o cadastro existente.',
      );
    }
    const correspondentes = produtos.filter(
      (item) =>
        item.tipo === 'BUILD' &&
        !/^KIT[_ -]?UPGRADE$/i.test(item.build?.categoria ?? '') &&
        // O modelo extraído pode ser apenas a CPU. Exigimos a identidade do
        // anúncio inteiro para não unir PCs de configurações diferentes.
        sameCatalogIdentity(
          { ...item, modelo: null },
          { ...buildPayload, modelo: null },
        ),
    );
    if (!produtoAnuncio && correspondentes.length > 1) {
      throw new ConflictException(
        'Mais de um PC montado corresponde ao anúncio. Revise os cadastros existentes.',
      );
    }
    const existente = produtoAnuncio || correspondentes[0];
    if (existente) {
      const produto = await this.publicarProdutoExistente(existente.id);
      const oferta = anuncioExistente
        ? await this.atualizarOferta(anuncioExistente.id, dados.oferta)
        : await this.ofertasService.criarOferta({
            ...this.ofertaBase(parceiro.id, dados.oferta),
            produtoId: existente.id,
          });
      return {
        status: anuncioExistente
          ? ('OFERTA_ATUALIZADA' as const)
          : ('NOVA_OFERTA_CRIADA' as const),
        produto: { id: produto.id, nome: produto.nome },
        parceiro,
        publicado: true,
        oferta,
        completouComIa: true,
      };
    }

    // O anúncio comercial pode informar peças sem modelo. A descrição é
    // preservada; a extensão não inventa vínculos com Hardwares do catálogo.
    const build = await this.buildsCatalogoService.criar({
      ...buildPayload,
      categoria: 'PC_MONTADO',
      componentes: [],
      publicado: true,
      ativo: true,
      oferta: this.ofertaBase(parceiro.id, dados.oferta),
    });
    return {
      status: 'BUILD_E_OFERTA_CRIADOS' as const,
      build: { id: build.id },
      produto: { id: build.produtoId, nome: build.produto.nome },
      parceiro,
      publicado: true,
      oferta: build.produto.ofertas?.[0] ?? null,
      completouComIa: true,
      observacao:
        'PC montado cadastrado, publicado e oferta criada pela extensão.',
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
      await this.publicarProdutoExistente(hardware.produtoId);
    }

    const parceiro = await this.resolverParceiro(dados.parceiro);
    const ofertasResultado = await this.ofertasService.listarOfertas();
    const codigoMarketplace = this.codigoOferta(dados.oferta);
    const existente = ofertasResultado.ofertas.find((item) =>
      this.mesmaOfertaHardware(
        item as unknown as Registro,
        hardwareId,
        parceiro.id,
        dados.oferta.urlOriginal,
        codigoMarketplace,
        dados.oferta.vendedorIdentificador,
      ),
    );

    if (existente) {
      const atualizada = await this.atualizarOferta(existente.id, dados.oferta);
      return {
        status: 'OFERTA_ATUALIZADA' as const,
        hardwareStatus: registroHardware.status,
        hardware: { id: hardwareId, nome: hardware.nome },
        parceiro,
        publicado: true,
        oferta: atualizada,
        completouComIa: true,
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
        parceiro,
        publicado: true,
        oferta,
        completouComIa: true,
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
      parceiro,
      produto,
      publicado: true,
      oferta: produto.ofertas?.[0] ?? null,
      completouComIa: true,
      observacao:
        'Novo Hardware/Produto criado e publicado automaticamente pela extensão.',
    };
  }

  async importarOfertaExtensao(dados: ImportarOfertaExtensaoProdutoIaDto) {
    const destinos = [
      Boolean(dados.hardwarePayload),
      Boolean(dados.produtoPayload),
      Boolean(dados.buildPayload),
      Boolean(dados.hardwareExistenteId),
      Boolean(dados.produtoExistenteId),
    ].filter(Boolean).length;

    if (destinos !== 1) {
      throw new BadRequestException(
        'Informe exatamente um destino: Hardware/Produto/PC montado novo ou item existente.',
      );
    }

    if (dados.hardwareExistenteId || dados.produtoExistenteId) {
      return this.importarExistenteExtensao(dados);
    }
    if (dados.produtoPayload) {
      return this.importarProdutoExtensao(dados);
    }
    if (dados.buildPayload) {
      return this.importarBuildExtensao(dados);
    }
    return this.importarHardwareExtensao(dados);
  }
}
