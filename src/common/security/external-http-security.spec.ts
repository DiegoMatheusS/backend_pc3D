import {
  enderecoIpBloqueado,
  validarUrlPublica,
} from './external-http-security';

describe('external-http-security', () => {
  it('bloqueia endereços locais, privados e metadata', () => {
    expect(enderecoIpBloqueado('127.0.0.1')).toBe(true);
    expect(enderecoIpBloqueado('10.0.0.10')).toBe(true);
    expect(enderecoIpBloqueado('169.254.169.254')).toBe(true);
    expect(enderecoIpBloqueado('192.168.1.1')).toBe(true);
    expect(enderecoIpBloqueado('::1')).toBe(true);
    expect(enderecoIpBloqueado('::ffff:127.0.0.1')).toBe(true);
  });

  it('aceita IPs públicos conhecidos', () => {
    expect(enderecoIpBloqueado('8.8.8.8')).toBe(false);
    expect(enderecoIpBloqueado('1.1.1.1')).toBe(false);
  });

  it('rejeita localhost sem fazer requisição externa', async () => {
    await expect(validarUrlPublica('http://localhost/produto')).rejects.toThrow(
      'rede interna',
    );
  });

  it('rejeita IP de metadata cloud sem fazer requisição externa', async () => {
    await expect(
      validarUrlPublica('http://169.254.169.254/latest/meta-data'),
    ).rejects.toThrow('rede interna');
  });

  it('rejeita portas externas não permitidas', async () => {
    await expect(validarUrlPublica('http://8.8.8.8:8080/')).rejects.toThrow(
      'porta',
    );
  });
});
