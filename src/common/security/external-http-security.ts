import { lookup } from 'node:dns/promises';
import type { IncomingHttpHeaders, RequestOptions } from 'node:http';
import { request as requisicaoHttp } from 'node:http';
import { request as requisicaoHttps } from 'node:https';
import { isIP } from 'node:net';
import { checkServerIdentity, type PeerCertificate } from 'node:tls';

export interface RespostaHttpExternaSegura {
  status: number;
  ok: boolean;
  url: URL;
  headers: IncomingHttpHeaders;
  corpo: Buffer;
}

export interface OpcoesRequisicaoExternaSegura {
  timeoutMs?: number;
  limiteRespostaBytes?: number;
  headers?: Record<string, string>;
}

export class ErroUrlExternaSegura extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroUrlExternaSegura';
  }
}

function ipv4Bloqueado(ip: string): boolean {
  const partes = ip.split('.').map(Number);
  if (partes.length !== 4 || partes.some((parte) => !Number.isInteger(parte))) {
    return true;
  }

  const [a, b, c] = partes;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function ipv6Bloqueado(valor: string): boolean {
  const ip = valor.toLowerCase();

  if (ip.startsWith('::ffff:')) {
    const mapeado = ip.slice('::ffff:'.length);
    return isIP(mapeado) !== 4 || ipv4Bloqueado(mapeado);
  }

  return (
    ip === '::' ||
    ip === '::1' ||
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    /^fe[89ab]/u.test(ip) ||
    ip.startsWith('ff') ||
    ip.startsWith('64:ff9b:') ||
    ip.startsWith('2001:0000:') ||
    ip.startsWith('2001:0:') ||
    ip.startsWith('2001:db8:') ||
    ip === '2001:db8::' ||
    ip.startsWith('2002:')
  );
}

export function enderecoIpBloqueado(endereco: string): boolean {
  const ip = endereco.replace(/^\[|\]$/gu, '').toLowerCase();
  const versao = isIP(ip);

  if (versao === 4) return ipv4Bloqueado(ip);
  if (versao === 6) return ipv6Bloqueado(ip);

  return true;
}

function hostnameBloqueado(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/gu, '').toLowerCase();

  return (
    host === 'localhost' ||
    host === 'metadata' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa')
  );
}

function validarPorta(url: URL): void {
  const porta = url.port;
  if (!porta) return;

  const permitida =
    (url.protocol === 'http:' && porta === '80') ||
    (url.protocol === 'https:' && porta === '443');

  if (!permitida) {
    throw new ErroUrlExternaSegura(
      'A URL usa uma porta que não é permitida para acesso externo.',
    );
  }
}

export async function validarUrlPublica(valor: string | URL): Promise<{
  url: URL;
  endereco: string;
  familia: 4 | 6;
}> {
  let url: URL;

  try {
    url = valor instanceof URL ? new URL(valor.toString()) : new URL(valor);
  } catch {
    throw new ErroUrlExternaSegura('A URL informada é inválida.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ErroUrlExternaSegura(
      'A URL precisa usar o protocolo HTTP ou HTTPS.',
    );
  }

  if (url.username || url.password) {
    throw new ErroUrlExternaSegura(
      'URLs com credenciais embutidas não são permitidas.',
    );
  }

  validarPorta(url);

  const hostname = url.hostname.replace(/^\[|\]$/gu, '').toLowerCase();

  if (hostnameBloqueado(hostname)) {
    throw new ErroUrlExternaSegura(
      'O endereço informado não pode apontar para uma rede interna.',
    );
  }

  const versaoLiteral = isIP(hostname);
  if (versaoLiteral !== 0) {
    if (enderecoIpBloqueado(hostname)) {
      throw new ErroUrlExternaSegura(
        'O endereço informado não pode apontar para uma rede interna.',
      );
    }

    return {
      url,
      endereco: hostname,
      familia: versaoLiteral === 6 ? 6 : 4,
    };
  }

  let enderecos: Array<{ address: string; family: 4 | 6 }>;
  try {
    enderecos = (await lookup(hostname, {
      all: true,
      verbatim: true,
    })) as Array<{ address: string; family: 4 | 6 }>;
  } catch {
    throw new ErroUrlExternaSegura(
      'Não foi possível resolver o endereço informado.',
    );
  }

  if (
    enderecos.length === 0 ||
    enderecos.some(({ address }) => enderecoIpBloqueado(address))
  ) {
    throw new ErroUrlExternaSegura(
      'O endereço informado não pode apontar para uma rede interna.',
    );
  }

  const escolhido = enderecos[0];
  if (!escolhido || (escolhido.family !== 4 && escolhido.family !== 6)) {
    throw new ErroUrlExternaSegura(
      'Não foi possível resolver um endereço público válido.',
    );
  }

  return {
    url,
    endereco: escolhido.address,
    familia: escolhido.family,
  };
}

export function obterCabecalhoHttp(
  resposta: Pick<RespostaHttpExternaSegura, 'headers'>,
  nome: string,
): string | undefined {
  const valor = resposta.headers[nome.toLowerCase()];
  if (Array.isArray(valor)) return valor[0];
  return typeof valor === 'string' ? valor : undefined;
}

export async function requisitarUrlPublicaUmaVez(
  valor: string | URL,
  opcoes: OpcoesRequisicaoExternaSegura = {},
): Promise<RespostaHttpExternaSegura> {
  // A resolução usada para a conexão é a mesma que foi validada. Isso evita
  // a janela DNS-check -> nova resolução que permitiria DNS rebinding/TOCTOU.
  const alvo = await validarUrlPublica(valor);
  const timeoutMs = opcoes.timeoutMs ?? 12_000;
  const limiteRespostaBytes = opcoes.limiteRespostaBytes ?? 2_000_000;
  const hostnameOriginal = alvo.url.hostname.replace(/^\[|\]$/gu, '');
  const porta = Number(
    alvo.url.port || (alvo.url.protocol === 'https:' ? 443 : 80),
  );

  const cabecalhos: Record<string, string> = {
    ...opcoes.headers,
    Host: alvo.url.host,
  };

  const requestOptions: RequestOptions = {
    protocol: alvo.url.protocol,
    hostname: alvo.endereco,
    family: alvo.familia,
    port: porta,
    method: 'GET',
    path: `${alvo.url.pathname}${alvo.url.search}`,
    headers: cabecalhos,
    agent: false,
  };

  if (alvo.url.protocol === 'https:') {
    Object.assign(requestOptions, {
      servername: isIP(hostnameOriginal) === 0 ? hostnameOriginal : undefined,
      rejectUnauthorized: true,
      checkServerIdentity: (_host: string, certificado: PeerCertificate) =>
        checkServerIdentity(hostnameOriginal, certificado),
    });
  }

  return await new Promise<RespostaHttpExternaSegura>((resolve, reject) => {
    const fazerRequisicao =
      alvo.url.protocol === 'https:' ? requisicaoHttps : requisicaoHttp;

    const req = fazerRequisicao(requestOptions, (resposta) => {
      const tamanhoInformado = Number(
        resposta.headers['content-length'] ?? '0',
      );

      if (
        Number.isFinite(tamanhoInformado) &&
        tamanhoInformado > limiteRespostaBytes
      ) {
        resposta.destroy();
        reject(
          new ErroUrlExternaSegura(
            'A resposta externa excede o limite de tamanho permitido.',
          ),
        );
        return;
      }

      const partes: Buffer[] = [];
      let total = 0;

      resposta.on('data', (parte: Buffer | string) => {
        const buffer = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
        total += buffer.byteLength;

        if (total > limiteRespostaBytes) {
          resposta.destroy(
            new ErroUrlExternaSegura(
              'A resposta externa excede o limite de tamanho permitido.',
            ),
          );
          return;
        }

        partes.push(buffer);
      });

      resposta.on('end', () => {
        const status = resposta.statusCode ?? 0;
        resolve({
          status,
          ok: status >= 200 && status < 300,
          url: alvo.url,
          headers: resposta.headers,
          corpo: Buffer.concat(partes),
        });
      });

      resposta.on('error', reject);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(
        new ErroUrlExternaSegura('Tempo limite ao acessar a URL externa.'),
      );
    });

    req.on('error', (erro: Error) => {
      if (erro instanceof ErroUrlExternaSegura) {
        reject(erro);
        return;
      }

      reject(new ErroUrlExternaSegura('Falha ao acessar a URL externa.'));
    });

    req.end();
  });
}
