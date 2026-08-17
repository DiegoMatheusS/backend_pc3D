import {
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type R2Configuracao = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
};

type UploadR2Resultado = {
  storageKey: string;
  arquivoUrl: string;
  tamanhoBytes: number;
  etag: string | null;
};

type ErroAws = Error & {
  name?: string;
  Code?: string;
  $metadata?: {
    httpStatusCode?: number;
    requestId?: string;
    attempts?: number;
  };
};

@Injectable()
export class R2StorageService {
  constructor(private readonly configService: ConfigService) {}

  status() {
    const endpoint =
      this.configService.get<string>('R2_ENDPOINT')?.trim() ?? '';
    const bucket = this.configService.get<string>('R2_BUCKET')?.trim() ?? '';
    const accessKeyId =
      this.configService.get<string>('R2_ACCESS_KEY_ID')?.trim() ?? '';
    const secretAccessKey =
      this.configService.get<string>('R2_SECRET_ACCESS_KEY')?.trim() ?? '';
    const publicUrl =
      this.configService.get<string>('R2_PUBLIC_URL')?.trim() ?? '';

    return {
      configurado: Boolean(
        endpoint && bucket && accessKeyId && secretAccessKey && publicUrl,
      ),
      bucket: bucket || null,
      endpoint: endpoint || null,
      publicUrl: publicUrl || null,
      credenciaisConfiguradas: Boolean(accessKeyId && secretAccessKey),
      cliente: 'AWS_SDK_V3',
      regiao: 'auto',
    };
  }

  async testarConexao() {
    const configuracao = this.obterConfiguracao();
    const cliente = this.criarCliente(configuracao);

    try {
      const resposta = await cliente.send(
        new HeadBucketCommand({ Bucket: configuracao.bucket }),
      );

      return {
        conectado: true,
        bucket: configuracao.bucket,
        endpoint: configuracao.endpoint,
        statusHttp: resposta.$metadata.httpStatusCode ?? 200,
        cliente: 'AWS_SDK_V3',
        regiao: 'auto',
      };
    } catch (erro) {
      throw this.criarErroR2(
        'Não foi possível autenticar/conectar ao bucket do Cloudflare R2.',
        erro,
      );
    } finally {
      cliente.destroy();
    }
  }

  normalizarStorageKey(valor: string): string {
    const chave = valor.trim().replace(/\\/g, '/').replace(/^\/+/, '');

    if (!chave || chave.length > 500) {
      throw new ConflictException('O caminho do arquivo no R2 é inválido.');
    }

    const segmentos = chave.split('/');
    if (
      segmentos.some(
        (segmento) =>
          !segmento ||
          segmento === '.' ||
          segmento === '..' ||
          segmento.length > 180,
      )
    ) {
      throw new ConflictException('O caminho do arquivo no R2 é inválido.');
    }

    if (!chave.toLowerCase().endsWith('.glb')) {
      throw new ConflictException('O arquivo no R2 precisa terminar em .glb.');
    }

    return chave;
  }

  async uploadGlb(
    storageKey: string,
    conteudo: Buffer,
  ): Promise<UploadR2Resultado> {
    const chave = this.normalizarStorageKey(storageKey);
    const configuracao = this.obterConfiguracao();
    const cliente = this.criarCliente(configuracao);

    try {
      if (await this.objetoExiste(cliente, configuracao.bucket, chave)) {
        throw new ConflictException(
          `Já existe um arquivo no R2 com o caminho "${chave}".`,
        );
      }

      const resposta = await cliente.send(
        new PutObjectCommand({
          Bucket: configuracao.bucket,
          Key: chave,
          Body: conteudo,
          ContentType: 'model/gltf-binary',
          CacheControl: 'public, max-age=3600',
        }),
      );

      return {
        storageKey: chave,
        arquivoUrl: this.criarUrlPublicaComConfiguracao(configuracao, chave),
        tamanhoBytes: conteudo.byteLength,
        etag: resposta.ETag ?? null,
      };
    } catch (erro) {
      if (erro instanceof ConflictException) {
        throw erro;
      }

      throw this.criarErroR2(
        'Não foi possível enviar o modelo 3D ao R2.',
        erro,
      );
    } finally {
      cliente.destroy();
    }
  }

  ehArquivoGerenciado(storageKey: string | null, arquivoUrl: string): boolean {
    if (!storageKey) {
      return false;
    }

    const publicUrl =
      this.configService
        .get<string>('R2_PUBLIC_URL')
        ?.trim()
        .replace(/\/+$/, '') ?? '';

    if (!publicUrl) {
      return false;
    }

    let chave: string;

    try {
      chave = this.normalizarStorageKey(storageKey);
    } catch {
      return false;
    }

    const urlEsperada = `${publicUrl}/${this.codificarCaminho(chave)}`;
    return arquivoUrl.trim() === urlEsperada;
  }

  async removerObjeto(storageKey: string): Promise<void> {
    const chave = this.normalizarStorageKey(storageKey);
    const configuracao = this.obterConfiguracao();
    const cliente = this.criarCliente(configuracao);

    try {
      await cliente.send(
        new DeleteObjectCommand({
          Bucket: configuracao.bucket,
          Key: chave,
        }),
      );
    } catch (erro) {
      throw this.criarErroR2(
        'Não foi possível remover o arquivo 3D do R2.',
        erro,
      );
    } finally {
      cliente.destroy();
    }
  }

  private async objetoExiste(
    cliente: S3Client,
    bucket: string,
    storageKey: string,
  ): Promise<boolean> {
    try {
      await cliente.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: storageKey,
        }),
      );
      return true;
    } catch (erro) {
      const erroAws = this.normalizarErroAws(erro);
      const status = erroAws.$metadata?.httpStatusCode;

      if (
        status === 404 ||
        erroAws.name === 'NotFound' ||
        erroAws.name === 'NoSuchKey' ||
        erroAws.Code === 'NoSuchKey'
      ) {
        return false;
      }

      throw erro;
    }
  }

  private obterConfiguracao(): R2Configuracao {
    const endpoint = this.configService.get<string>('R2_ENDPOINT')?.trim();
    const bucket = this.configService.get<string>('R2_BUCKET')?.trim();
    const accessKeyId = this.configService
      .get<string>('R2_ACCESS_KEY_ID')
      ?.trim();
    const secretAccessKey = this.configService
      .get<string>('R2_SECRET_ACCESS_KEY')
      ?.trim();
    const publicUrl = this.configService.get<string>('R2_PUBLIC_URL')?.trim();

    if (
      !endpoint ||
      !bucket ||
      !accessKeyId ||
      !secretAccessKey ||
      !publicUrl
    ) {
      throw new ServiceUnavailableException(
        'Cloudflare R2 não configurado. Defina R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_PUBLIC_URL.',
      );
    }

    let endpointUrl: URL;
    let publicUrlObjeto: URL;

    try {
      endpointUrl = new URL(endpoint);
      publicUrlObjeto = new URL(publicUrl);
    } catch {
      throw new ServiceUnavailableException(
        'R2_ENDPOINT ou R2_PUBLIC_URL está inválido.',
      );
    }

    if (endpointUrl.protocol !== 'https:') {
      throw new ServiceUnavailableException('R2_ENDPOINT precisa usar HTTPS.');
    }

    if (endpointUrl.pathname !== '/' && endpointUrl.pathname !== '') {
      throw new ServiceUnavailableException(
        'R2_ENDPOINT deve ser o endpoint da conta, sem o nome do bucket no final.',
      );
    }

    if (!['http:', 'https:'].includes(publicUrlObjeto.protocol)) {
      throw new ServiceUnavailableException(
        'R2_PUBLIC_URL precisa usar HTTP ou HTTPS.',
      );
    }

    return {
      endpoint: endpoint.replace(/\/+$/, ''),
      bucket,
      accessKeyId,
      secretAccessKey,
      publicUrl: publicUrl.replace(/\/+$/, ''),
    };
  }

  private criarCliente(configuracao: R2Configuracao): S3Client {
    return new S3Client({
      region: 'auto',
      endpoint: configuracao.endpoint,
      credentials: {
        accessKeyId: configuracao.accessKeyId,
        secretAccessKey: configuracao.secretAccessKey,
      },
      maxAttempts: 2,
    });
  }

  private criarUrlPublicaComConfiguracao(
    configuracao: R2Configuracao,
    storageKey: string,
  ): string {
    return `${configuracao.publicUrl}/${this.codificarCaminho(storageKey)}`;
  }

  private codificarCaminho(valor: string): string {
    return valor
      .split('/')
      .map((segmento) => this.codificarRfc3986(segmento))
      .join('/');
  }

  private codificarRfc3986(valor: string): string {
    return encodeURIComponent(valor).replace(
      /[!'()*]/g,
      (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  private normalizarErroAws(erro: unknown): ErroAws {
    if (erro instanceof Error) {
      return erro;
    }

    return new Error('Erro desconhecido retornado pelo cliente S3.');
  }

  private criarErroR2(
    mensagem: string,
    erro: unknown,
  ): ServiceUnavailableException {
    const erroAws = this.normalizarErroAws(erro);
    const status = erroAws.$metadata?.httpStatusCode;
    const codigo = erroAws.name || erroAws.Code;

    const detalhes = [
      status ? `HTTP ${status}` : null,
      codigo ? `código ${codigo}` : null,
      erroAws.message ? erroAws.message.slice(0, 180) : null,
    ]
      .filter(Boolean)
      .join(' — ');

    return new ServiceUnavailableException(
      detalhes ? `${mensagem} ${detalhes}` : mensagem,
    );
  }
}
