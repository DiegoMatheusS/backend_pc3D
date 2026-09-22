import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { HardwaresDescobertaIaService } from '../hardwares-descoberta-ia/hardwares-descoberta-ia.service';
import { HardwaresService } from '../hardwares/hardwares.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { ProdutosService } from '../produtos/produtos.service';
import { ImportarOfertaExtensaoProdutoIaDto } from './dtos/importar-oferta-extensao-produto-ia.dto';

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

  private mesmaOferta(
    oferta: Registro,
    hardwareId: number,
    parceiroId: number,
    urlOriginal: string,
    codigoMarketplace?: string | null,
  ): boolean {
    if (this.idParceiroOferta(oferta) !== parceiroId) return false;
    if (this.idHardwareOferta(oferta) !== hardwareId) return false;

    const codigoAtual = this.normalizar(oferta.codigoMarketplace);
    const codigoNovo = this.normalizar(codigoMarketplace);
    if (codigoAtual && codigoNovo && codigoAtual === codigoNovo) return true;

    const atual = this.urlCanonica(oferta.urlOriginal);
    const nova = this.urlCanonica(urlOriginal);
    return Boolean(atual && nova && atual === nova);
  }

  async importarOfertaExtensao(dados: ImportarOfertaExtensaoProdutoIaDto) {
    const registroHardware = await this.descobertaHardware.cadastrar({
      payload: dados.hardwarePayload,
    });

    const hardwareId = registroHardware.hardware.id;
    const hardware = await this.hardwaresService.buscarPorIdAdmin(hardwareId);

    const parceirosResultado = await this.ofertasService.listarParceiros();
    const nomeParceiro = this.normalizar(dados.parceiro.nome);
    const dominioParceiro = this.normalizar(dados.parceiro.dominio);

    let parceiro = parceirosResultado.parceiros.find((item) => {
      const mesmoNome = this.normalizar(item.nome) === nomeParceiro;
      const mesmoDominio =
        Boolean(dominioParceiro) &&
        this.normalizar(item.dominio) === dominioParceiro;
      return mesmoNome || mesmoDominio;
    });

    if (parceiro && parceiro.ativo === false) {
      throw new ConflictException(
        `O parceiro "${parceiro.nome}" existe, mas está desativado no Criabyte.`,
      );
    }

    if (!parceiro) {
      parceiro = await this.ofertasService.criarParceiro({
        nome: dados.parceiro.nome,
        dominio: dados.parceiro.dominio ?? null,
        site: dados.parceiro.site ?? null,
        programaAfiliados: true,
        observacao:
          'Criado automaticamente pela integração interna da extensão Criabyte.',
      });
    }

    const ofertasResultado = await this.ofertasService.listarOfertas();
    const existente = ofertasResultado.ofertas.find((item) =>
      this.mesmaOferta(
        item as unknown as Registro,
        hardwareId,
        parceiro.id,
        dados.oferta.urlOriginal,
        dados.oferta.codigoMarketplace,
      ),
    );

    if (existente) {
      const atualizada = await this.ofertasService.atualizarOferta(existente.id, {
        urlOriginal: dados.oferta.urlOriginal,
        urlAfiliada: dados.oferta.urlAfiliada,
        preco: dados.oferta.preco,
        precoAnterior: dados.oferta.precoAnterior ?? undefined,
        codigoMarketplace: dados.oferta.codigoMarketplace ?? undefined,
        vendedorNome: dados.oferta.vendedorNome ?? undefined,
        vendedorIdentificador:
          dados.oferta.vendedorIdentificador ?? undefined,
      });

      return {
        status: 'OFERTA_ATUALIZADA' as const,
        hardwareStatus: registroHardware.status,
        hardware: { id: hardwareId, nome: hardware.nome },
        parceiro: { id: parceiro.id, nome: parceiro.nome },
        oferta: atualizada,
      };
    }

    const ofertaBase = {
      parceiroId: parceiro.id,
      urlOriginal: dados.oferta.urlOriginal,
      urlAfiliada: dados.oferta.urlAfiliada,
      preco: dados.oferta.preco,
      ...(dados.oferta.precoAnterior !== undefined && {
        precoAnterior: dados.oferta.precoAnterior,
      }),
      ...(dados.oferta.codigoMarketplace && {
        codigoMarketplace: dados.oferta.codigoMarketplace,
      }),
      ...(dados.oferta.vendedorNome && {
        vendedorNome: dados.oferta.vendedorNome,
      }),
      ...(dados.oferta.vendedorIdentificador && {
        vendedorIdentificador: dados.oferta.vendedorIdentificador,
      }),
    };

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
        oferta,
      };
    }

    const produto = await this.produtosService.criarDeHardware(hardwareId, {
      publicado: false,
      ativo: true,
      ofertaInicial: ofertaBase,
    });

    return {
      status: 'HARDWARE_E_OFERTA_CRIADOS' as const,
      hardwareStatus: registroHardware.status,
      hardware: { id: hardwareId, nome: hardware.nome },
      parceiro: { id: parceiro.id, nome: parceiro.nome },
      produto,
      publicado: false,
      observacao: 'Novo Hardware/Produto criado como rascunho para revisão.',
    };
  }
}
