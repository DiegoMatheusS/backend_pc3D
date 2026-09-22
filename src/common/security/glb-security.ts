export interface ResultadoValidacaoGlb {
  valido: boolean;
  motivo?: string;
}

const GLB_MAGIC = 'glTF';
const GLB_VERSION = 2;
const CHUNK_JSON = 0x4e4f534a;
const MAX_JSON_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_CHUNKS = 32;

function possuiUriExterna(documento: unknown): boolean {
  if (!documento || typeof documento !== 'object') return false;
  const raiz = documento as Record<string, unknown>;

  const buffers = Array.isArray(raiz.buffers) ? raiz.buffers : [];
  for (const item of buffers) {
    if (!item || typeof item !== 'object') continue;
    const uri = (item as Record<string, unknown>).uri;
    if (typeof uri === 'string' && uri.trim()) return true;
  }

  const images = Array.isArray(raiz.images) ? raiz.images : [];
  for (const item of images) {
    if (!item || typeof item !== 'object') continue;
    const uri = (item as Record<string, unknown>).uri;
    if (typeof uri === 'string' && uri.trim()) return true;
  }

  return false;
}

export function validarGlbAutocontido(buffer: Buffer): ResultadoValidacaoGlb {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength < 20) {
    return { valido: false, motivo: 'Arquivo GLB pequeno ou inválido.' };
  }

  if (buffer.toString('ascii', 0, 4) !== GLB_MAGIC) {
    return { valido: false, motivo: 'Cabeçalho GLB inválido.' };
  }

  if (buffer.readUInt32LE(4) !== GLB_VERSION) {
    return { valido: false, motivo: 'Somente GLB 2.0 é permitido.' };
  }

  if (buffer.readUInt32LE(8) !== buffer.byteLength) {
    return { valido: false, motivo: 'Tamanho declarado do GLB não corresponde ao arquivo.' };
  }

  let offset = 12;
  let chunks = 0;
  let jsonEncontrado = false;

  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) {
      return { valido: false, motivo: 'Cabeçalho de chunk GLB truncado.' };
    }

    const tamanho = buffer.readUInt32LE(offset);
    const tipo = buffer.readUInt32LE(offset + 4);
    offset += 8;
    chunks += 1;

    if (chunks > MAX_CHUNKS) {
      return { valido: false, motivo: 'GLB possui chunks demais.' };
    }

    if (tamanho <= 0 || tamanho % 4 !== 0 || offset + tamanho > buffer.byteLength) {
      return { valido: false, motivo: 'Estrutura de chunks GLB inválida.' };
    }

    if (chunks === 1 && tipo !== CHUNK_JSON) {
      return { valido: false, motivo: 'O primeiro chunk do GLB precisa ser JSON.' };
    }

    if (tipo === CHUNK_JSON) {
      if (jsonEncontrado) {
        return { valido: false, motivo: 'GLB possui mais de um chunk JSON.' };
      }
      if (tamanho > MAX_JSON_CHUNK_BYTES) {
        return { valido: false, motivo: 'Chunk JSON do GLB excede o limite permitido.' };
      }

      const texto = buffer
        .subarray(offset, offset + tamanho)
        .toString('utf8')
        .replace(/[\u0000\u0020]+$/gu, '');

      let documento: unknown;
      try {
        documento = JSON.parse(texto);
      } catch {
        return { valido: false, motivo: 'JSON interno do GLB é inválido.' };
      }

      if (possuiUriExterna(documento)) {
        return {
          valido: false,
          motivo:
            'O GLB precisa ser autocontido e não pode referenciar buffers ou imagens por URI.',
        };
      }

      jsonEncontrado = true;
    }

    offset += tamanho;
  }

  if (offset !== buffer.byteLength || !jsonEncontrado) {
    return { valido: false, motivo: 'Estrutura GLB incompleta.' };
  }

  return { valido: true };
}
