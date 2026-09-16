import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiException } from '../exceptions/api.exception';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

/**
 * Filtro global que padroniza TODAS as respostas de erro da API no formato:
 *
 * {
 *   "statusCode": 400,
 *   "codigo":     "PONTO_ENCAIXE_OCUPADO",   ← machine-readable
 *   "mensagem":   "Texto legível",
 *   "detalhes":   {}
 * }
 *
 * Exceções sem código explícito recebem um código derivado do status HTTP.
 */
@Catch()
export class FiltroHttpExcecoes implements ExceptionFilter {
  private readonly logger = new Logger(FiltroHttpExcecoes.name);

  private converterParaTexto(valor: unknown): string {
    if (typeof valor === 'string') {
      return valor;
    }

    if (
      typeof valor === 'number' ||
      typeof valor === 'boolean' ||
      typeof valor === 'bigint'
    ) {
      return String(valor);
    }

    if (valor === null) {
      return 'null';
    }

    if (valor === undefined) {
      return 'undefined';
    }

    if (valor instanceof Error) {
      return valor.message;
    }

    try {
      const serializado = JSON.stringify(valor);

      return serializado ?? 'Valor não serializável';
    } catch {
      return 'Valor não serializável';
    }
  }

  private mascararSegredos(valor: string): string {
    return valor
      .replace(
        /(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/giu,
        '$1[REDACTED]',
      )
      .replace(/(cookie\s*[:=]\s*)[^\n]+/giu, '$1[REDACTED]')
      .replace(
        /((?:token|secret|password|senha|credential)\s*[:=]\s*)[^\s,;]+/giu,
        '$1[REDACTED]',
      )
      .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/gu, '[REDACTED]');
  }

  private ehErroValidacaoPrisma(excecao: unknown): excecao is Error {
    return (
      excecao instanceof Error &&
      excecao.name === 'PrismaClientValidationError'
    );
  }

  catch(excecao: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const resposta = ctx.getResponse<Response>();
    const requisicao = ctx.getRequest<Request>();

    // ── 1. ApiException — possui código explícito ──────────────────────────
    if (excecao instanceof ApiException) {
      const corpo = excecao.getResponse() as {
        codigo: string;
        mensagem: string;
        detalhes: Record<string, unknown>;
      };

      resposta.status(excecao.getStatus()).json({
        statusCode: excecao.getStatus(),
        codigo: corpo.codigo,
        mensagem: corpo.mensagem,
        detalhes: corpo.detalhes ?? {},
      });
      return;
    }

    // ── 2. HttpException padrão do NestJS ──────────────────────────────────
    if (excecao instanceof HttpException) {
      const status = excecao.getStatus();
      const respBody = excecao.getResponse();

      let mensagem: string;

      if (typeof respBody === 'string') {
        mensagem = respBody;
      } else if (
        typeof respBody === 'object' &&
        respBody !== null &&
        'message' in respBody
      ) {
        const msg = respBody.message;

        mensagem = Array.isArray(msg)
          ? msg.map((item) => this.converterParaTexto(item)).join('; ')
          : this.converterParaTexto(msg);
      } else {
        mensagem = excecao.message;
      }

      resposta.status(status).json({
        statusCode: status,
        codigo: this.codigoPorStatus(status),
        mensagem,
        detalhes: {},
      });
      return;
    }

    // ── 3. Erros conhecidos do Prisma ──────────────────────────────────────
    if (excecao instanceof PrismaClientKnownRequestError) {
      const { codigo, status, mensagem } = this.traduzirErroPrisma(excecao);

      this.logger.warn(
        `Prisma ${excecao.code} em ${requisicao.method} ${requisicao.path}`,
      );

      resposta.status(status).json({
        statusCode: status,
        codigo,
        mensagem,
        detalhes: {},
      });
      return;
    }

    // ── 4. Prisma rejeitou a estrutura do payload ──────────────────────────
    // PrismaClientValidationError não possui código Pxxxx e antes caía no 500
    // genérico, o que escondia erros como nested create recebendo null.
    if (this.ehErroValidacaoPrisma(excecao)) {
      this.logger.warn(
        `Payload rejeitado pelo Prisma em ${requisicao.method} ${requisicao.path}: ${this.mascararSegredos(excecao.message)}`,
      );

      resposta.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        codigo: 'PAYLOAD_PRISMA_INVALIDO',
        mensagem:
          'Os dados técnicos enviados não correspondem ao formato esperado para cadastro.',
        detalhes: {},
      });
      return;
    }

    // ── 5. Erro genérico inesperado ────────────────────────────────────────
    this.logger.error(
      `Erro inesperado em ${requisicao.method} ${requisicao.url}`,
      this.mascararSegredos(
        excecao instanceof Error
          ? (excecao.stack ?? excecao.message)
          : this.converterParaTexto(excecao),
      ),
    );

    resposta.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Ocorreu um erro interno no servidor.',
      detalhes: {},
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private codigoPorStatus(status: number): string {
    const mapa: Record<number, string> = {
      400: 'REQUISICAO_INVALIDA',
      401: 'NAO_AUTENTICADO',
      403: 'ACESSO_NEGADO',
      404: 'NAO_ENCONTRADO',
      409: 'CONFLITO',
      413: 'PAYLOAD_MUITO_GRANDE',
      422: 'ENTIDADE_NAO_PROCESSAVEL',
      429: 'LIMITE_EXCEDIDO',
      500: 'ERRO_INTERNO',
      503: 'SERVICO_INDISPONIVEL',
    };
    return mapa[status] ?? 'ERRO_DESCONHECIDO';
  }

  private traduzirErroPrisma(erro: PrismaClientKnownRequestError): {
    codigo: string;
    status: number;
    mensagem: string;
  } {
    switch (erro.code) {
      case 'P2002':
        return {
          codigo: 'REGISTRO_DUPLICADO',
          status: HttpStatus.CONFLICT,
          mensagem: 'Já existe um registro com esses dados.',
        };
      case 'P2003':
        return {
          codigo: 'REFERENCIA_INVALIDA',
          status: HttpStatus.BAD_REQUEST,
          mensagem: 'Um ou mais registros relacionados não existem.',
        };
      case 'P2025':
        return {
          codigo: 'NAO_ENCONTRADO',
          status: HttpStatus.NOT_FOUND,
          mensagem: 'Registro não encontrado.',
        };
      default:
        return {
          codigo: 'ERRO_BANCO_DADOS',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          mensagem: 'Erro ao acessar o banco de dados.',
        };
    }
  }
}
