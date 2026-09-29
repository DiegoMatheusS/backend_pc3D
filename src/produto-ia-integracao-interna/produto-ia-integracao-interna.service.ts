import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { HardwaresDescobertaIaService } from '../hardwares-descoberta-ia/hardwares-descoberta-ia.service';
import { HardwaresService } from '../hardwares/hardwares.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import {
  ImportarOfertaExtensaoProdutoIaDto,
  OfertaExtensaoDto,
  ParceiroOfertaExtensaoDto,
  ProdutoOfertaExtensaoDto,
} from './dtos/importar-oferta-extensao-produto-ia.dto';
import { LocalizarItemExtensaoProdutoIaDto } from './dtos/localizar-item-extensao-produto-ia.dto';

type Registro = Record<string, unknown>;
type CriterioIdentidade =
  | 'ASIN'
  | 'GTIN'
  | 'MPN_MARCA'
  | 'MARCA_MODELO'
  | 'NOME_MARCA';

type CriterioBusca = {
  criterio: CriterioIdentidade;
  whereProduto: Prisma.ProdutoWhereInput;
  whereHardware: Prisma.HardwareWhereInput;
};

@Injectable()
export class ProdutoIaIntegracaoInternaService {
  constructor(
    private readonly descobertaHardware: HardwaresDescobertaIaService,
    private readonly hardwaresService: HardwaresService,
    private readonly ofertasService: OfertasService,
    private readonly produtosService: ProdutosService,
    private readonly prisma: PrismaService,
  ) {}

  private normalizar(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '')
      .trim();
  }

  private normalizarAsin(valor: unknown): string | null {
    const asin = String(valor ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/gu, '');
    return /^[A-Z0-9]{10}$/u.test(asin) ? asin : null;
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

  private asinProduto(produto: Registro): string | null {
    const metadados = produto.metadados;
    if (!metadados || typeof metadados !== 'object' || Array.isArray(metadados)) {
      return null;
    }
    return this.normalizarAsin((metadados as Registro).asin);
  }

  private mesmoProdutoGenerico(
    produto: Registro,
    categoriaId: number,
    dados: ProdutoOfertaExtensaoDto,
  ): boolean {
    if (this.normalizar(produto.tipo) !== 'generico') return false;
    if (this.categoriaIdProduto(produto) !== categoriaId) return false;

    const asinAtual = this.asinProduto(produto);
    const asinNovo = this.normalizarAsin(dados.asin);
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

  private dadosProdutoParaPersistencia(dados: ProdutoOfertaExtensaoDto) {
    const { categoriaSlug: _categoriaSlug, asin, metadados, ...resto } = dados;
    void _categoriaSlug;
    const asinNormalizado = this.normalizarAsin(asin);
    const metadata = {
      ...(metadados ?? {}),
      ...(asinNormalizado ? { asin: asinNormalizado } : {}),
    };
    return {
      ...resto,
      ...(Object.keys(metadata).length ? { metadados: metadata } : {}),
    };
  }

  private async publicarProdutoExistente(
    produtoId: number,
    dados: ProdutoOfertaExtensaoDto,
  ) {
    const atual = await this.produtosService.buscarAdmin(produtoId);
    const persistencia = this.dadosProdutoParaPersistencia(dados);
    const metadadosAtuais =
      atual.metadados &&
      typeof atual.metadados === 'object' &&
      !Array.isArray(atual.metadados)
        ? (atual.metadados as Record<string, unknown>)
        : {};
    return this.produtosService.atualizar(produtoId, {
      ...persistencia,
      ...(persistencia.metadados
        ? { metadados: { ...metadadosAtuais, ...persistencia.metadados } }
        : {}),
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

  private codigoMarketplaceOferta(dados: OfertaExtensaoDto): string | undefined {
    const codigo = String(dados.codigoMarketplace ?? '').trim();
    if (codigo) return codigo;
    return this.normalizarAsin(dados.asin) ?? undefined;
  }

  private ofertaBase(parceiroId: number, dados: OfertaExtensaoDto) {
    const codigoMarketplace = this.codigoMarketplaceOferta(dados);
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
      codigoMarketplace: this.codigoMarketplaceOferta(dados),
      vendedorNome: dados.vendedorNome ?? undefined,
      vendedorIdentificador: dados.vendedorIdentificador ?? undefined,
    });
  }

  private respostaProdutoLocalizado(
    produto: {
      id: number;
      nome: string;
      marca: string | null;
      modelo: string | null;
      gtin: string | null;
      mpn: string | null;
      publicado: boolean;
      hardware: { id: number; categoria: string } | null;
      categoria: { id: number; nome: string; slug: string };
    },
    criterio: CriterioIdentidade,
  ) {
    if (produto.hardware) {
      return {
        encontrado: true,
        tipo: 'HARDWARE' as const,
        criterio,
        hardware: {
          id: produto.hardware.id,
          nome: produto.nome,
          categoria: produto.hardware.categoria,
          produtoId: produto.id,
        },
        produto: {
          id: produto.id,
          nome: produto.nome,
          categoria: produto.categoria,
          publicado: produto.publicado,
        },
      };
    }
    return {
      encontrado: true,
      tipo: 'PRODUTO' as const,
      criterio,
      produto: {
        id: produto.id,
        nome: produto.nome,
        marca: produto.marca,
        modelo: produto.modelo,
        gtin: produto.gtin,
        mpn: produto.mpn,
        categoria: produto.categoria,
        publicado: produto.publicado,
      },
    };
  }

  async localizarItemExtensao(dados: LocalizarItemExtensaoProdutoIaDto) {
    const asin = this.normalizarAsin(dados.asin);
    const gtin = String(dados.gtin ?? '').trim();
    const mpn = String(dados.mpn ?? '').trim();
    const marca = String(dados.marca ?? '').trim();
    const modelo = String(dados.modelo ?? '').trim();
    const nome = String(dados.nome ?? '').trim();

    if (!asin && !gtin && !mpn && !(marca && modelo) && !(nome && marca)) {
      return { encontrado: false, motivo: 'IDENTIDADE_INSUFICIENTE' as const };
    }

    const includeProduto = {
      categoria: { select: { id: true, nome: true, slug: true } },
      hardware: { select: { id: true, categoria: true } },
    } as const;

    if (asin) {
      const produtos = await this.prisma.produto.findMany({
        where: { ativo: true },
        include: includeProduto,
        take: 250,
        orderBy: { atualizadoEm: 'desc' },
      });
      const porAsin = produtos.find(
        (produto) => this.asinProduto(produto as unknown as Registro) === asin,
      );
      if (porAsin) return this.respostaProdutoLocalizado(porAsin, 'ASIN');

      const ofertaAsin = await this.prisma.oferta.findFirst({
        where: {
          codigoMarketplace: asin,
          produto: { ativo: true },
        },
        include: {
          produto: { include: includeProduto },
        },
        orderBy: { atualizadoEm: 'desc' },
      });
      if (ofertaAsin?.produto) {
        return this.respostaProdutoLocalizado(ofertaAsin.produto, 'ASIN');
      }
    }

    const criterios: CriterioBusca[] = [];
    if (gtin) {
      criterios.push({
        criterio: 'GTIN',
        whereProduto: { gtin },
        whereHardware: { gtin },
      });
    }
    if (mpn && marca) {
      criterios.push({
        criterio: 'MPN_MARCA',
        whereProduto: {
          mpn: { equals: mpn, mode: 'insensitive' },
          marca: { equals: marca, mode: 'insensitive' },
        },
        whereHardware: {
          mpn: { equals: mpn, mode: 'insensitive' },
          marca: { equals: marca, mode: 'insensitive' },
        },
      });
    }
    if (marca && modelo) {
      criterios.push({
        criterio: 'MARCA_MODELO',
        whereProduto: {
          marca: { equals: marca, mode: 'insensitive' },
          modelo: { equals: modelo, mode: 'insensitive' },
        },
        whereHardware: {
          marca: { equals: marca, mode: 'insensitive' },
          modelo: { equals: modelo, mode: 'insensitive' },
        },
      });
    }
    if (nome && marca) {
      criterios.push({
        criterio: 'NOME_MARCA',
        whereProduto: {
          nome: { equals: nome, mode: 'insensitive' },
          marca: { equals: marca, mode: 'insensitive' },
        },
        whereHardware: {
          nome: { equals: nome, mode: 'insensitive' },
          marca: { equals: marca, mode: 'insensitive' },
        },
      });
    }

    for (const criterio of criterios) {
      const produto = await this.prisma.produto.findFirst({
        where: { ativo: true, ...criterio.whereProduto },
        include: includeProduto,
        orderBy: { atualizadoEm: 'desc' },
      });
      if (produto) return this.respostaProdutoLocalizado(produto, criterio.criterio);

      const hardware = await this.prisma.hardware.findFirst({
        where: { ativo: true, ...criterio.whereHardware },
        select: {
          id: true,
          produtoId: true,
          nome: true,
          marca: true,
          modelo: true,
          gtin: true,
          mpn: true,
          categoria: true,
          publicado: true,
        },
        orderBy: { atualizadoEm: 'desc' },
      });
      if (hardware) {
        return {
          encontrado: true,
          tipo: 'HARDWARE' as const,
          criterio: criterio.criterio,
          hardware,
          produto: hardware.produtoId ? { id: hardware.produtoId } : null,
        };
      }
    }

    return { encontrado: false, motivo: 'ITEM_NAO_ENCONTRADO' as const };
  }

  private async importarOfertaProdutoExistente(
    produtoId: number,
    dados: ImportarOfertaExtensaoProdutoIaDto,
  ) {
    const produto = await this.produtosService.buscarAdmin(produtoId);
    if (!produto.ativo) {
      throw new BadRequestException('Produto existente está inativo.');
    }
    const parceiro = await this.resolverParceiro(dados.parceiro);
    const ofertasResultado = await this.ofertasService.listarOfertas();
    const codigoMarketplace = this.codigoMarketplaceOferta(dados.oferta);
    const existente = ofertasResultado.ofertas.find(
      (item) =>
        this.idProdutoOferta(item as unknown as Registro) === produtoId &&
        this.mesmaPublicacao(
          item as unknown as Registro,
          parceiro.id,
          dados.oferta.urlOriginal,
          codigoMarketplace,
        ),
    );
    if (existente) {
      const oferta = await this.atualizarOferta(existente.id, dados.oferta);
      return {
        status: 'OFERTA_ATUALIZADA' as const,
        reutilizado: true,
        produto: { id: produto.id, nome: produto.nome },
        parceiro,
        oferta,
      };
    }
    const oferta = await this.ofertasService.criarOferta({
      ...this.ofertaBase(parceiro.id, dados.oferta),
      produtoId,
    });
    return {
      status: 'NOVA_OFERTA_CRIADA' as const,
      reutilizado: true,
      produto: { id: produto.id, nome: produto.nome },
      parceiro,
      oferta,
    };
  }

  private async importarOfertaHardwareExistente(
    hardwareId: number,
    dados: ImportarOfertaExtensaoProdutoIaDto,
  ) {
    const hardware = await this.hardwaresService.buscarPorIdAdmin(hardwareId);
    const parceiro = await this.resolverParceiro(dados.parceiro);
    if (!hardware.produtoId) {
      const produto = await this.produtosService.criarDeHardware(hardwareId, {
        publicado: true,
        ativo: true,
        ofertaInicial: this.ofertaBase(parceiro.id, dados.oferta),
      });
      return {
        status: 'PRODUTO_DE_HARDWARE_E_OFERTA_CRIADOS' as const,
        reutilizado: true,
        hardware: { id: hardware.id, nome: hardware.nome },
        produto: { id: produto.id, nome: produto.nome },
        parceiro,
        publicado: true,
        oferta: produto.ofertas?.[0] ?? null,
      };
    }

    const ofertasResultado = await this.ofertasService.listarOfertas();
    const codigoMarketplace = this.codigoMarketplaceOferta(dados.oferta);
    const existente = ofertasResultado.ofertas.find((item) =>
      this.mesmaOfertaHardware(
        item as unknown as Registro,
        hardwareId,
        parceiro.id,
        dados.oferta.urlOriginal,
        codigoMarketplace,
      ),
    );
    if (existente) {
      const oferta = await this.atualizarOferta(existente.id, dados.oferta);
      return {
        status: 'OFERTA_ATUALIZADA' as const,
        reutilizado: true,
        hardware: { id: hardware.id, nome: hardware.nome },
        produto: { id: hardware.produtoId },
        parceiro,
        oferta,
      };
    }
    const oferta = await this.ofertasService.criarOferta({
      ...this.ofertaBase(parceiro.id, dados.oferta),
      hardwareId,
    });
    return {
      status: 'NOVA_OFERTA_CRIADA' as const,
      reutilizado: true,
      hardware: { id: hardware.id, nome: hardware.nome },
      produto: { id: hardware.produtoId },
      parceiro,
      oferta,
    };
  }

  private async importarProdutoExtensao(
    dados: ImportarOfertaExtensaoProdutoIaDto,
  ) {
    const produtoPayload = dados.produtoPayload!;
    const parceiro = await this.resolverParceiro(dados.parceiro);
    const ofertasResultado = await this.ofertasService.listarOfertas();
    const codigoMarketplace = this.codigoMarketplaceOferta(dados.oferta);

    const anuncioExistente = ofertasResultado.ofertas.find((item) =>
      this.mesmaPublicacao(
        item as unknown as Registro,
        parceiro.id,
        dados.oferta.urlOriginal,
        codigoMarketplace,
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

    const dadosProduto = this.dadosProdutoParaPersistencia(produtoPayload);
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
    const codigoMarketplace = this.codigoMarketplaceOferta(dados.oferta);
    const existente = ofertasResultado.ofertas.find((item) =>
      this.mesmaOfertaHardware(
        item as unknown as Registro,
        hardwareId,
        parceiro.id,
        dados.oferta.urlOriginal,
        codigoMarketplace,
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
      oferta: produto.ofertas?.[0] ?? null,
      observacao: 'Novo Hardware/Produto criado e publicado automaticamente pela extensão.',
    };
  }

  async importarOfertaExtensao(dados: ImportarOfertaExtensaoProdutoIaDto) {
    const destinos = [
      Boolean(dados.hardwarePayload),
      Boolean(dados.produtoPayload),
      Boolean(dados.produtoExistenteId),
      Boolean(dados.hardwareExistenteId),
    ].filter(Boolean).length;

    if (destinos !== 1) {
      throw new BadRequestException(
        'Informe exatamente um destino: hardwarePayload, produtoPayload, produtoExistenteId ou hardwareExistenteId.',
      );
    }

    if (dados.produtoExistenteId) {
      return this.importarOfertaProdutoExistente(dados.produtoExistenteId, dados);
    }
    if (dados.hardwareExistenteId) {
      return this.importarOfertaHardwareExistente(dados.hardwareExistenteId, dados);
    }
    if (dados.produtoPayload) {
      return this.importarProdutoExtensao(dados);
    }
    return this.importarHardwareExtensao(dados);
  }
}
