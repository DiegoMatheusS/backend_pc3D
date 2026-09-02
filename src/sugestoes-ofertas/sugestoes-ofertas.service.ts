import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma, StatusOferta, TipoProduto } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import {
  CATEGORIAS_SUGESTAO_OFERTA,
  CategoriaSugestaoOferta,
  FORMULARIOS_SUGESTAO_OFERTA,
  ehCategoriaSugestaoOferta,
} from './campos-sugestao-oferta';
import { AceitarOfertaExistenteDto } from './dtos/aceitar-oferta-existente.dto';
import { AprovarSugestaoOfertaDto } from './dtos/aprovar-sugestao-oferta.dto';
import { CriarSugestaoOfertaDto } from './dtos/criar-sugestao-oferta.dto';

const STATUS_SUGESTAO = {
  EM_ANALISE: 'EM_ANALISE',
  APROVADA: 'APROVADA',
  REJEITADA: 'REJEITADA',
} as const;

type StatusSugestao = (typeof STATUS_SUGESTAO)[keyof typeof STATUS_SUGESTAO];

const STATUS_VALIDOS = Object.values(STATUS_SUGESTAO) as StatusSugestao[];
const LIMITE_SUGESTOES_24H = 10;

type SugestaoRow = {
  id: number;
  usuarioId: number;
  produtoId: number | null;
  parceiroId: number | null;
  ofertaId: number | null;
  nome: string;
  urlOriginal: string;
  categoria: string;
  preco: unknown;
  precoAnterior: unknown;
  especificacoes: unknown;
  observacaoUsuario: string | null;
  status: string;
  analisadoPorId: number | null;
  analisadoEm: Date | null;
  motivoAnalise: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  usuarioNome?: string | null;
  usuarioEmail?: string | null;
  produtoNome?: string | null;
  parceiroNome?: string | null;
  analisadoPorNome?: string | null;
  ofertaUrlAfiliada?: string | null;
};

type ContagemRow = { total: unknown };

type BancoTransacional = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SugestoesOfertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoesService: NotificacoesService,
  ) {}

  obterFormulario() {
    return {
      limiteSugestoesPor24h: LIMITE_SUGESTOES_24H,
      categorias: CATEGORIAS_SUGESTAO_OFERTA.map(
        (categoria) => FORMULARIOS_SUGESTAO_OFERTA[categoria],
      ),
    };
  }

  async criar(usuarioId: number, dados: CriarSugestaoOfertaDto) {
    const nome = dados.nome.trim();
    if (nome.length < 2) {
      throw new BadRequestException('Informe um nome válido para o produto.');
    }

    if (!ehCategoriaSugestaoOferta(dados.categoria)) {
      throw new BadRequestException('Categoria de sugestão inválida.');
    }

    const urlOriginal = this.normalizarUrl(dados.urlOriginal);
    const especificacoes = this.validarEspecificacoes(
      dados.categoria,
      dados.especificacoes ?? {},
    );

    const [contagem] = await this.prisma.$queryRaw<ContagemRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "total"
      FROM "sugestoes_ofertas"
      WHERE "usuario_id" = ${usuarioId}
        AND "criado_em" >= NOW() - INTERVAL '24 hours'
    `);

    if (Number(contagem?.total ?? 0) >= LIMITE_SUGESTOES_24H) {
      throw new HttpException(
        `Limite de ${LIMITE_SUGESTOES_24H} sugestões em 24 horas atingido.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ofertaExistente = await this.prisma.oferta.findFirst({
      where: { urlOriginal },
      select: { id: true },
    });
    if (ofertaExistente) {
      throw new ConflictException('Essa URL já está cadastrada como oferta.');
    }

    const pendentes = await this.prisma.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`
        SELECT "id"
        FROM "sugestoes_ofertas"
        WHERE "url_original" = ${urlOriginal}
          AND "status" = CAST(${STATUS_SUGESTAO.EM_ANALISE} AS "StatusSugestaoOferta")
        LIMIT 1
      `,
    );
    if (pendentes.length > 0) {
      throw new ConflictException(
        'Já existe uma sugestão em análise para essa URL.',
      );
    }

    let produtoId: number | null = null;
    if (dados.produtoId) {
      const produto = await this.buscarProdutoAtivo(
        this.prisma,
        dados.produtoId,
      );
      this.validarCategoriaProduto(dados.categoria, produto);
      produtoId = produto.id;
    }

    const parceiroId = await this.inferirParceiroPelaUrl(urlOriginal);
    const especificacoesJson = JSON.stringify(especificacoes);
    const observacao = dados.observacao?.trim() || null;

    const criadas = await this.prisma.$queryRaw<SugestaoRow[]>(Prisma.sql`
      INSERT INTO "sugestoes_ofertas" (
        "usuario_id",
        "produto_id",
        "parceiro_id",
        "nome",
        "url_original",
        "categoria",
        "preco",
        "preco_anterior",
        "especificacoes",
        "observacao_usuario",
        "status",
        "atualizado_em"
      ) VALUES (
        ${usuarioId},
        ${produtoId},
        ${parceiroId},
        ${nome},
        ${urlOriginal},
        ${dados.categoria},
        ${dados.preco},
        ${dados.precoAnterior ?? null},
        CAST(${especificacoesJson} AS JSONB),
        ${observacao},
        CAST(${STATUS_SUGESTAO.EM_ANALISE} AS "StatusSugestaoOferta"),
        NOW()
      )
      RETURNING
        "id",
        "usuario_id" AS "usuarioId",
        "produto_id" AS "produtoId",
        "parceiro_id" AS "parceiroId",
        "oferta_id" AS "ofertaId",
        "nome",
        "url_original" AS "urlOriginal",
        "categoria",
        "preco",
        "preco_anterior" AS "precoAnterior",
        "especificacoes",
        "observacao_usuario" AS "observacaoUsuario",
        "status"::text AS "status",
        "analisado_por_id" AS "analisadoPorId",
        "analisado_em" AS "analisadoEm",
        "motivo_analise" AS "motivoAnalise",
        "criado_em" AS "criadoEm",
        "atualizado_em" AS "atualizadoEm"
    `);

    return this.buscarMinha(usuarioId, criadas[0].id);
  }

  async listarMinhas(usuarioId: number) {
    const rows = await this.prisma.$queryRaw<SugestaoRow[]>(Prisma.sql`
      SELECT
        s."id",
        s."usuario_id" AS "usuarioId",
        s."produto_id" AS "produtoId",
        s."parceiro_id" AS "parceiroId",
        s."oferta_id" AS "ofertaId",
        s."nome",
        s."url_original" AS "urlOriginal",
        s."categoria",
        s."preco",
        s."preco_anterior" AS "precoAnterior",
        s."especificacoes",
        s."observacao_usuario" AS "observacaoUsuario",
        s."status"::text AS "status",
        s."analisado_por_id" AS "analisadoPorId",
        s."analisado_em" AS "analisadoEm",
        s."motivo_analise" AS "motivoAnalise",
        s."criado_em" AS "criadoEm",
        s."atualizado_em" AS "atualizadoEm",
        p."nome" AS "produtoNome",
        par."nome" AS "parceiroNome",
        a."nome" AS "analisadoPorNome",
        o."url_afiliada" AS "ofertaUrlAfiliada"
      FROM "sugestoes_ofertas" s
      LEFT JOIN "produtos" p ON p."id" = s."produto_id"
      LEFT JOIN "parceiros" par ON par."id" = s."parceiro_id"
      LEFT JOIN "usuarios" a ON a."id" = s."analisado_por_id"
      LEFT JOIN "ofertas" o ON o."id" = s."oferta_id"
      WHERE s."usuario_id" = ${usuarioId}
      ORDER BY s."criado_em" DESC
      LIMIT 100
    `);

    return {
      total: rows.length,
      sugestoes: rows.map((row) => this.mapearSugestao(row)),
    };
  }

  async buscarMinha(usuarioId: number, id: number) {
    const rows = await this.prisma.$queryRaw<SugestaoRow[]>(Prisma.sql`
      SELECT
        s."id",
        s."usuario_id" AS "usuarioId",
        s."produto_id" AS "produtoId",
        s."parceiro_id" AS "parceiroId",
        s."oferta_id" AS "ofertaId",
        s."nome",
        s."url_original" AS "urlOriginal",
        s."categoria",
        s."preco",
        s."preco_anterior" AS "precoAnterior",
        s."especificacoes",
        s."observacao_usuario" AS "observacaoUsuario",
        s."status"::text AS "status",
        s."analisado_por_id" AS "analisadoPorId",
        s."analisado_em" AS "analisadoEm",
        s."motivo_analise" AS "motivoAnalise",
        s."criado_em" AS "criadoEm",
        s."atualizado_em" AS "atualizadoEm",
        p."nome" AS "produtoNome",
        par."nome" AS "parceiroNome",
        a."nome" AS "analisadoPorNome",
        o."url_afiliada" AS "ofertaUrlAfiliada"
      FROM "sugestoes_ofertas" s
      LEFT JOIN "produtos" p ON p."id" = s."produto_id"
      LEFT JOIN "parceiros" par ON par."id" = s."parceiro_id"
      LEFT JOIN "usuarios" a ON a."id" = s."analisado_por_id"
      LEFT JOIN "ofertas" o ON o."id" = s."oferta_id"
      WHERE s."id" = ${id} AND s."usuario_id" = ${usuarioId}
      LIMIT 1
    `);

    if (!rows[0]) throw new NotFoundException('Sugestão não encontrada.');
    return this.mapearSugestao(rows[0]);
  }

  async listarAdmin(filtros: {
    status?: string;
    categoria?: string;
    busca?: string;
  }) {
    const status = filtros.status?.trim() || null;
    if (status && !(STATUS_VALIDOS as readonly string[]).includes(status)) {
      throw new BadRequestException('Status de sugestão inválido.');
    }

    const categoria = filtros.categoria?.trim() || null;
    if (categoria && !ehCategoriaSugestaoOferta(categoria)) {
      throw new BadRequestException('Categoria de sugestão inválida.');
    }

    const busca = filtros.busca?.trim().slice(0, 100) || null;
    const buscaLike = busca ? `%${busca.toLowerCase()}%` : null;

    const rows = await this.prisma.$queryRaw<SugestaoRow[]>(Prisma.sql`
      SELECT
        s."id",
        s."usuario_id" AS "usuarioId",
        s."produto_id" AS "produtoId",
        s."parceiro_id" AS "parceiroId",
        s."oferta_id" AS "ofertaId",
        s."nome",
        s."url_original" AS "urlOriginal",
        s."categoria",
        s."preco",
        s."preco_anterior" AS "precoAnterior",
        s."especificacoes",
        s."observacao_usuario" AS "observacaoUsuario",
        s."status"::text AS "status",
        s."analisado_por_id" AS "analisadoPorId",
        s."analisado_em" AS "analisadoEm",
        s."motivo_analise" AS "motivoAnalise",
        s."criado_em" AS "criadoEm",
        s."atualizado_em" AS "atualizadoEm",
        u."nome" AS "usuarioNome",
        u."email" AS "usuarioEmail",
        p."nome" AS "produtoNome",
        par."nome" AS "parceiroNome",
        a."nome" AS "analisadoPorNome",
        o."url_afiliada" AS "ofertaUrlAfiliada"
      FROM "sugestoes_ofertas" s
      INNER JOIN "usuarios" u ON u."id" = s."usuario_id"
      LEFT JOIN "produtos" p ON p."id" = s."produto_id"
      LEFT JOIN "parceiros" par ON par."id" = s."parceiro_id"
      LEFT JOIN "usuarios" a ON a."id" = s."analisado_por_id"
      LEFT JOIN "ofertas" o ON o."id" = s."oferta_id"
      WHERE (${status}::text IS NULL OR s."status"::text = ${status})
        AND (${categoria}::text IS NULL OR s."categoria" = ${categoria})
        AND (
          ${buscaLike}::text IS NULL
          OR LOWER(s."nome") LIKE ${buscaLike}
          OR LOWER(s."url_original") LIKE ${buscaLike}
          OR LOWER(u."nome") LIKE ${buscaLike}
        )
      ORDER BY
        CASE WHEN s."status" = CAST(${STATUS_SUGESTAO.EM_ANALISE} AS "StatusSugestaoOferta") THEN 0 ELSE 1 END,
        s."criado_em" DESC
      LIMIT 200
    `);

    const emAnalise = rows.filter(
      (row) => row.status === STATUS_SUGESTAO.EM_ANALISE,
    ).length;

    return {
      total: rows.length,
      emAnalise,
      sugestoes: rows.map((row) => this.mapearSugestao(row, true)),
    };
  }

  async buscarAdmin(id: number) {
    const rows = await this.prisma.$queryRaw<SugestaoRow[]>(Prisma.sql`
      SELECT
        s."id",
        s."usuario_id" AS "usuarioId",
        s."produto_id" AS "produtoId",
        s."parceiro_id" AS "parceiroId",
        s."oferta_id" AS "ofertaId",
        s."nome",
        s."url_original" AS "urlOriginal",
        s."categoria",
        s."preco",
        s."preco_anterior" AS "precoAnterior",
        s."especificacoes",
        s."observacao_usuario" AS "observacaoUsuario",
        s."status"::text AS "status",
        s."analisado_por_id" AS "analisadoPorId",
        s."analisado_em" AS "analisadoEm",
        s."motivo_analise" AS "motivoAnalise",
        s."criado_em" AS "criadoEm",
        s."atualizado_em" AS "atualizadoEm",
        u."nome" AS "usuarioNome",
        u."email" AS "usuarioEmail",
        p."nome" AS "produtoNome",
        par."nome" AS "parceiroNome",
        a."nome" AS "analisadoPorNome",
        o."url_afiliada" AS "ofertaUrlAfiliada"
      FROM "sugestoes_ofertas" s
      INNER JOIN "usuarios" u ON u."id" = s."usuario_id"
      LEFT JOIN "produtos" p ON p."id" = s."produto_id"
      LEFT JOIN "parceiros" par ON par."id" = s."parceiro_id"
      LEFT JOIN "usuarios" a ON a."id" = s."analisado_por_id"
      LEFT JOIN "ofertas" o ON o."id" = s."oferta_id"
      WHERE s."id" = ${id}
      LIMIT 1
    `);

    if (!rows[0]) throw new NotFoundException('Sugestão não encontrada.');
    return this.mapearSugestao(rows[0], true);
  }

  async aprovar(id: number, adminId: number, dados: AprovarSugestaoOfertaDto) {
    if (dados.produtoId !== undefined && dados.hardwareId !== undefined) {
      throw new BadRequestException(
        'Informe produtoId ou hardwareId, mas não os dois.',
      );
    }

    const oferta = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<SugestaoRow[]>(Prisma.sql`
        SELECT
          "id",
          "usuario_id" AS "usuarioId",
          "produto_id" AS "produtoId",
          "parceiro_id" AS "parceiroId",
          "oferta_id" AS "ofertaId",
          "nome",
          "url_original" AS "urlOriginal",
          "categoria",
          "preco",
          "preco_anterior" AS "precoAnterior",
          "especificacoes",
          "observacao_usuario" AS "observacaoUsuario",
          "status"::text AS "status",
          "analisado_por_id" AS "analisadoPorId",
          "analisado_em" AS "analisadoEm",
          "motivo_analise" AS "motivoAnalise",
          "criado_em" AS "criadoEm",
          "atualizado_em" AS "atualizadoEm"
        FROM "sugestoes_ofertas"
        WHERE "id" = ${id}
        FOR UPDATE
      `);
      const sugestao = rows[0];
      if (!sugestao) throw new NotFoundException('Sugestão não encontrada.');
      if (sugestao.status !== STATUS_SUGESTAO.EM_ANALISE) {
        throw new ConflictException('Essa sugestão já foi analisada.');
      }

      const produto = await this.resolverProdutoAprovacao(tx, sugestao, dados);
      this.validarCategoriaProduto(sugestao.categoria, produto);

      const parceiroId = dados.parceiroId ?? sugestao.parceiroId;
      if (!parceiroId) {
        throw new BadRequestException(
          'Selecione o parceiro/loja antes de aprovar a sugestão.',
        );
      }

      const parceiro = await tx.parceiro.findFirst({
        where: { id: parceiroId, ativo: true },
        select: { id: true, nome: true, programaAfiliados: true },
      });
      if (!parceiro) {
        throw new NotFoundException('Parceiro não encontrado ou inativo.');
      }

      const urlAfiliada = dados.urlAfiliada?.trim() || null;
      if (parceiro.programaAfiliados && !urlAfiliada) {
        throw new BadRequestException(
          'Esse parceiro usa programa de afiliados. Informe a URL afiliada antes de aprovar.',
        );
      }

      const existente = await tx.oferta.findFirst({
        where: {
          produtoId: produto.id,
          parceiroId: parceiro.id,
          urlOriginal: sugestao.urlOriginal,
        },
        select: { id: true },
      });
      if (existente) {
        throw new ConflictException('Essa oferta já está cadastrada.');
      }

      const agora = new Date();
      const preco = dados.preco ?? Number(sugestao.preco);
      const precoAnterior =
        dados.precoAnterior !== undefined
          ? dados.precoAnterior
          : sugestao.precoAnterior === null
            ? null
            : Number(sugestao.precoAnterior);

      const criada = await tx.oferta.create({
        data: {
          produtoId: produto.id,
          usuarioOrigemId: sugestao.usuarioId,
          hardwareId: produto.hardware?.id ?? null,
          parceiroId: parceiro.id,
          urlOriginal: sugestao.urlOriginal,
          urlAfiliada,
          preco,
          precoAnterior,
          frete: dados.frete ?? null,
          validoAte: dados.validoAte ? new Date(dados.validoAte) : null,
          verificadoEm: agora,
          status: StatusOferta.ATIVA,
          coletadoEm: agora,
          historicoPrecos: {
            create: {
              preco,
              frete: dados.frete ?? null,
              verificadoEm: agora,
            },
          },
        },
        include: {
          produto: { select: { id: true, nome: true, slug: true } },
          hardware: { select: { id: true, nome: true, categoria: true } },
          parceiro: { select: { id: true, nome: true, slug: true } },
          usuarioOrigem: { select: { id: true, nome: true } },
        },
      });

      await tx.produto.updateMany({
        where: { id: produto.id, usuarioOrigemId: null },
        data: { usuarioOrigemId: sugestao.usuarioId },
      });

      await tx.$executeRaw(Prisma.sql`
        UPDATE "sugestoes_ofertas"
        SET
          "status" = CAST(${STATUS_SUGESTAO.APROVADA} AS "StatusSugestaoOferta"),
          "produto_id" = ${produto.id},
          "parceiro_id" = ${parceiro.id},
          "oferta_id" = ${criada.id},
          "analisado_por_id" = ${adminId},
          "analisado_em" = NOW(),
          "motivo_analise" = ${dados.observacao?.trim() || null},
          "atualizado_em" = NOW()
        WHERE "id" = ${id}
      `);

      await this.notificacoesService.criar(
        {
          usuarioId: sugestao.usuarioId,
          tipo: 'SUGESTAO_OFERTA_APROVADA',
          titulo: 'Sugestão aprovada',
          mensagem: 'Sua sugestão de oferta foi aprovada e publicada.',
          referenciaTipo: 'SUGESTAO_OFERTA',
          referenciaId: String(id),
          chaveDedupe: `sugestao-oferta:${id}:APROVADA`,
        },
        tx,
      );

      return criada;
    });

    return {
      sugestao: await this.buscarAdmin(id),
      oferta,
    };
  }

  async aceitarExistente(
    id: number,
    adminId: number,
    dados: AceitarOfertaExistenteDto,
  ) {
    const ofertaId = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<SugestaoRow[]>(Prisma.sql`
        SELECT
          "id",
          "usuario_id" AS "usuarioId",
          "produto_id" AS "produtoId",
          "parceiro_id" AS "parceiroId",
          "oferta_id" AS "ofertaId",
          "nome",
          "url_original" AS "urlOriginal",
          "categoria",
          "preco",
          "preco_anterior" AS "precoAnterior",
          "especificacoes",
          "observacao_usuario" AS "observacaoUsuario",
          "status"::text AS "status",
          "analisado_por_id" AS "analisadoPorId",
          "analisado_em" AS "analisadoEm",
          "motivo_analise" AS "motivoAnalise",
          "criado_em" AS "criadoEm",
          "atualizado_em" AS "atualizadoEm"
        FROM "sugestoes_ofertas"
        WHERE "id" = ${id}
        FOR UPDATE
      `);

      const sugestao = rows[0];
      if (!sugestao) throw new NotFoundException('Sugestão não encontrada.');
      if (sugestao.status !== STATUS_SUGESTAO.EM_ANALISE) {
        throw new ConflictException('Essa sugestão já foi analisada.');
      }

      const produto = await this.buscarProdutoAtivo(tx, dados.produtoId);
      this.validarCategoriaProduto(sugestao.categoria, produto);

      const ofertasProduto = await tx.oferta.findMany({
        where: { produtoId: produto.id },
        select: {
          id: true,
          produtoId: true,
          parceiroId: true,
          urlOriginal: true,
          usuarioOrigemId: true,
          sugestaoOrigem: { select: { id: true, usuarioId: true } },
        },
      });

      const ofertasCorrespondentes = ofertasProduto.filter((oferta) =>
        this.urlsEquivalentes(oferta.urlOriginal, sugestao.urlOriginal),
      );

      if (ofertasCorrespondentes.length === 0) {
        throw new NotFoundException(
          'Nenhuma Oferta cadastrada para o Produto selecionado corresponde ao link desta sugestão. Crie a Oferta primeiro e depois aceite a sugestão.',
        );
      }

      if (ofertasCorrespondentes.length > 1) {
        throw new ConflictException(
          'Há mais de uma Oferta correspondente ao link desta sugestão. Revise as ofertas duplicadas antes de aceitar.',
        );
      }

      const oferta = ofertasCorrespondentes[0];
      if (oferta.sugestaoOrigem && oferta.sugestaoOrigem.id !== sugestao.id) {
        throw new ConflictException(
          'Essa Oferta já está vinculada a outra sugestão.',
        );
      }

      if (
        oferta.usuarioOrigemId !== null &&
        oferta.usuarioOrigemId !== sugestao.usuarioId
      ) {
        throw new ConflictException(
          'Essa Oferta já possui outro usuário registrado como origem.',
        );
      }

      await tx.oferta.update({
        where: { id: oferta.id },
        data: { usuarioOrigemId: sugestao.usuarioId },
      });

      // O Produto mantém o primeiro usuário que originou seu cadastro.
      // Se ainda não houver origem, a autoria desta sugestão é preservada.
      await tx.produto.updateMany({
        where: { id: produto.id, usuarioOrigemId: null },
        data: { usuarioOrigemId: sugestao.usuarioId },
      });

      await tx.$executeRaw(Prisma.sql`
        UPDATE "sugestoes_ofertas"
        SET
          "status" = CAST(${STATUS_SUGESTAO.APROVADA} AS "StatusSugestaoOferta"),
          "produto_id" = ${produto.id},
          "parceiro_id" = ${oferta.parceiroId},
          "oferta_id" = ${oferta.id},
          "analisado_por_id" = ${adminId},
          "analisado_em" = NOW(),
          "motivo_analise" = ${'Oferta existente vinculada pelo Admin.'},
          "atualizado_em" = NOW()
        WHERE "id" = ${id}
      `);

      await this.notificacoesService.criar(
        {
          usuarioId: sugestao.usuarioId,
          tipo: 'SUGESTAO_OFERTA_APROVADA',
          titulo: 'Sugestão aprovada',
          mensagem: 'Sua sugestão de oferta foi aprovada e publicada.',
          referenciaTipo: 'SUGESTAO_OFERTA',
          referenciaId: String(id),
          chaveDedupe: `sugestao-oferta:${id}:APROVADA`,
        },
        tx,
      );

      return oferta.id;
    });

    const oferta = await this.prisma.oferta.findUnique({
      where: { id: ofertaId },
      include: {
        produto: { select: { id: true, nome: true, slug: true } },
        hardware: { select: { id: true, nome: true, categoria: true } },
        parceiro: { select: { id: true, nome: true, slug: true } },
        usuarioOrigem: { select: { id: true, nome: true } },
      },
    });

    return {
      sugestao: await this.buscarAdmin(id),
      oferta: oferta
        ? {
            ...oferta,
            cadastradoPor: oferta.usuarioOrigem,
            usuarioOrigem: undefined,
          }
        : null,
    };
  }

  async rejeitar(id: number, adminId: number, motivo: string) {
    const motivoNormalizado = motivo.trim();
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ status: string; usuarioId: number }>
      >(Prisma.sql`
        SELECT
          "status"::text AS "status",
          "usuario_id" AS "usuarioId"
        FROM "sugestoes_ofertas"
        WHERE "id" = ${id}
        FOR UPDATE
      `);
      if (!rows[0]) throw new NotFoundException('Sugestão não encontrada.');
      if (rows[0].status !== STATUS_SUGESTAO.EM_ANALISE) {
        throw new ConflictException('Essa sugestão já foi analisada.');
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE "sugestoes_ofertas"
        SET
          "status" = CAST(${STATUS_SUGESTAO.REJEITADA} AS "StatusSugestaoOferta"),
          "analisado_por_id" = ${adminId},
          "analisado_em" = NOW(),
          "motivo_analise" = ${motivoNormalizado},
          "atualizado_em" = NOW()
        WHERE "id" = ${id}
      `);

      await this.notificacoesService.criar(
        {
          usuarioId: rows[0].usuarioId,
          tipo: 'SUGESTAO_OFERTA_REJEITADA',
          titulo: 'Sugestão rejeitada',
          mensagem: `Sua sugestão de oferta foi rejeitada. Motivo: ${motivoNormalizado}`,
          referenciaTipo: 'SUGESTAO_OFERTA',
          referenciaId: String(id),
          chaveDedupe: `sugestao-oferta:${id}:REJEITADA`,
        },
        tx,
      );
    });

    return this.buscarAdmin(id);
  }

  private async resolverProdutoAprovacao(
    tx: Prisma.TransactionClient,
    sugestao: SugestaoRow,
    dados: AprovarSugestaoOfertaDto,
  ) {
    if (dados.hardwareId !== undefined) {
      const hardware = await tx.hardware.findFirst({
        where: { id: dados.hardwareId, ativo: true },
        select: { id: true, produtoId: true },
      });
      if (!hardware || !hardware.produtoId) {
        throw new NotFoundException(
          'Hardware não encontrado, inativo ou sem Produto vinculado.',
        );
      }
      return this.buscarProdutoAtivo(tx, hardware.produtoId);
    }

    const produtoId = dados.produtoId ?? sugestao.produtoId;
    if (!produtoId) {
      throw new BadRequestException(
        'Selecione um Produto existente antes de aprovar a sugestão.',
      );
    }
    return this.buscarProdutoAtivo(tx, produtoId);
  }

  private async buscarProdutoAtivo(
    banco: BancoTransacional,
    produtoId: number,
  ) {
    const produto = await banco.produto.findFirst({
      where: { id: produtoId, ativo: true },
      select: {
        id: true,
        nome: true,
        tipo: true,
        hardware: { select: { id: true, categoria: true } },
      },
    });
    if (!produto) {
      throw new NotFoundException('Produto não encontrado ou inativo.');
    }
    return produto;
  }

  private validarCategoriaProduto(
    categoria: string,
    produto: Awaited<ReturnType<SugestoesOfertasService['buscarProdutoAtivo']>>,
  ) {
    if (categoria === 'NOTEBOOK' && produto.tipo !== TipoProduto.NOTEBOOK) {
      throw new BadRequestException(
        'A sugestão é de Notebook, mas o Produto selecionado não é um Notebook.',
      );
    }

    if (
      produto.hardware &&
      ehCategoriaSugestaoOferta(categoria) &&
      categoria !== 'NOTEBOOK' &&
      categoria !== 'OUTRO' &&
      produto.hardware.categoria !== categoria
    ) {
      throw new BadRequestException(
        `A categoria da sugestão (${categoria}) não corresponde ao Hardware selecionado (${produto.hardware.categoria}).`,
      );
    }
  }

  private async inferirParceiroPelaUrl(urlOriginal: string) {
    const hostname = new URL(urlOriginal).hostname
      .toLowerCase()
      .replace(/^www\./, '');
    const parceiros = await this.prisma.parceiro.findMany({
      where: { ativo: true, dominio: { not: null } },
      select: { id: true, dominio: true },
    });

    const parceiro = parceiros.find((item) => {
      const dominio = item.dominio?.toLowerCase().replace(/^www\./, '');
      return Boolean(
        dominio && (hostname === dominio || hostname.endsWith(`.${dominio}`)),
      );
    });
    return parceiro?.id ?? null;
  }

  private urlsEquivalentes(a: string, b: string): boolean {
    try {
      return this.normalizarUrl(a) === this.normalizarUrl(b);
    } catch {
      return a.trim() === b.trim();
    }
  }

  private normalizarUrl(valor: string) {
    try {
      const url = new URL(valor.trim());
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Protocolo inválido');
      }
      if (url.username || url.password) {
        throw new Error('Credenciais na URL não são permitidas');
      }
      url.hash = '';
      url.hostname = url.hostname.toLowerCase();
      return url.toString();
    } catch {
      throw new BadRequestException('URL da oferta inválida.');
    }
  }

  private validarEspecificacoes(
    categoria: CategoriaSugestaoOferta,
    valor: Record<string, unknown>,
  ): Record<string, string | number | boolean> {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
      throw new BadRequestException('especificacoes deve ser um objeto.');
    }

    const campos = FORMULARIOS_SUGESTAO_OFERTA[categoria].campos;
    const mapa = new Map(campos.map((item) => [item.chave, item]));
    const entradas = Object.entries(valor);
    if (entradas.length > 20) {
      throw new BadRequestException('Muitas especificações foram enviadas.');
    }

    const normalizadas: Record<string, string | number | boolean> = {};
    for (const [chave, bruto] of entradas) {
      const definicao = mapa.get(chave);
      if (!definicao) {
        throw new BadRequestException(
          `O campo técnico "${chave}" não pertence à categoria ${categoria}.`,
        );
      }
      if (bruto === null || bruto === undefined || bruto === '') continue;

      if (definicao.tipo === 'numero') {
        if (typeof bruto !== 'number' || !Number.isFinite(bruto)) {
          throw new BadRequestException(
            `${definicao.rotulo} deve ser numérico.`,
          );
        }
        if (definicao.minimo !== undefined && bruto < definicao.minimo) {
          throw new BadRequestException(
            `${definicao.rotulo} deve ser no mínimo ${definicao.minimo}.`,
          );
        }
        if (definicao.maximo !== undefined && bruto > definicao.maximo) {
          throw new BadRequestException(
            `${definicao.rotulo} deve ser no máximo ${definicao.maximo}.`,
          );
        }
        normalizadas[chave] = bruto;
        continue;
      }

      if (definicao.tipo === 'booleano') {
        if (typeof bruto !== 'boolean') {
          throw new BadRequestException(
            `${definicao.rotulo} deve ser verdadeiro ou falso.`,
          );
        }
        normalizadas[chave] = bruto;
        continue;
      }

      if (typeof bruto !== 'string') {
        throw new BadRequestException(`${definicao.rotulo} deve ser texto.`);
      }
      const texto = bruto.trim();
      if (!texto) continue;
      const limite = chave === 'detalhes' ? 1000 : 200;
      if (texto.length > limite) {
        throw new BadRequestException(
          `${definicao.rotulo} excede o limite de ${limite} caracteres.`,
        );
      }
      if (
        definicao.tipo === 'selecao' &&
        definicao.opcoes &&
        !definicao.opcoes.includes(texto)
      ) {
        throw new BadRequestException(
          `${definicao.rotulo} possui uma opção inválida.`,
        );
      }
      normalizadas[chave] = texto;
    }

    return normalizadas;
  }

  private mapearSugestao(row: SugestaoRow, incluirUsuario = false) {
    return {
      id: row.id,
      nome: row.nome,
      urlOriginal: row.urlOriginal,
      categoria: row.categoria,
      preco: Number(row.preco),
      precoAnterior:
        row.precoAnterior === null ? null : Number(row.precoAnterior),
      especificacoes: row.especificacoes ?? {},
      observacao: row.observacaoUsuario,
      status: row.status,
      produto: row.produtoId
        ? { id: row.produtoId, nome: row.produtoNome ?? null }
        : null,
      parceiro: row.parceiroId
        ? { id: row.parceiroId, nome: row.parceiroNome ?? null }
        : null,
      ofertaId: row.ofertaId,
      ofertaUrlAfiliada: row.ofertaUrlAfiliada ?? null,
      analise: row.analisadoEm
        ? {
            analisadoEm: row.analisadoEm,
            analisadoPorId: row.analisadoPorId,
            analisadoPorNome: row.analisadoPorNome ?? null,
            motivo: row.motivoAnalise,
          }
        : null,
      criadoEm: row.criadoEm,
      atualizadoEm: row.atualizadoEm,
      ...(incluirUsuario
        ? {
            usuario: {
              id: row.usuarioId,
              nome: row.usuarioNome ?? null,
              email: row.usuarioEmail ?? null,
            },
          }
        : {}),
    };
  }
}
