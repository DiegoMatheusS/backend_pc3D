import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exceção HTTP com código machine-readable para o frontend.
 *
 * Uso:
 *   throw new ApiException(HttpStatus.BAD_REQUEST, 'PONTO_ENCAIXE_OCUPADO', 'Mensagem legível.');
 */
export class ApiException extends HttpException {
  readonly codigo: string;
  readonly detalhes: Record<string, unknown>;

  constructor(
    status: HttpStatus,
    codigo: string,
    mensagem: string,
    detalhes: Record<string, unknown> = {},
  ) {
    super({ codigo, mensagem, detalhes }, status);
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}
