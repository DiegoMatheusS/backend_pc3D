import { validarGlbAutocontido } from './glb-security';

function criarGlb(documento: Record<string, unknown>): Buffer {
  const jsonBruto = Buffer.from(JSON.stringify(documento), 'utf8');
  const padding = (4 - (jsonBruto.length % 4)) % 4;
  const json = Buffer.concat([jsonBruto, Buffer.alloc(padding, 0x20)]);
  const total = 12 + 8 + json.length;
  const buffer = Buffer.alloc(total);

  buffer.write('glTF', 0, 'ascii');
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(total, 8);
  buffer.writeUInt32LE(json.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  json.copy(buffer, 20);

  return buffer;
}

describe('validarGlbAutocontido', () => {
  it('aceita GLB 2.0 autocontido', () => {
    expect(validarGlbAutocontido(criarGlb({ asset: { version: '2.0' } }))).toEqual({
      valido: true,
    });
  });

  it('rejeita imagem externa', () => {
    const resultado = validarGlbAutocontido(
      criarGlb({
        asset: { version: '2.0' },
        images: [{ uri: 'https://exemplo.com/textura.png' }],
      }),
    );
    expect(resultado.valido).toBe(false);
  });

  it('rejeita buffer externo', () => {
    const resultado = validarGlbAutocontido(
      criarGlb({
        asset: { version: '2.0' },
        buffers: [{ uri: 'arquivo.bin', byteLength: 4 }],
      }),
    );
    expect(resultado.valido).toBe(false);
  });

  it('rejeita comprimento declarado incorreto', () => {
    const glb = criarGlb({ asset: { version: '2.0' } });
    glb.writeUInt32LE(glb.length + 4, 8);
    expect(validarGlbAutocontido(glb).valido).toBe(false);
  });
});
