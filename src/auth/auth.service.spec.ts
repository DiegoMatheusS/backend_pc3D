import { ConfigService } from '@nestjs/config';
import { PapelUsuario } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import {
  GoogleIdentityService,
  IdentidadeGoogleVerificada,
} from './google-identity.service';

type UsuarioTeste = {
  id: number;
  nome: string;
  email: string;
  senhaHash: string;
  googleSub: string | null;
  papel: PapelUsuario;
  ativo: boolean;
};

describe('AuthService — Google', () => {
  const identidade: IdentidadeGoogleVerificada = {
    sub: 'google-sub-123',
    email: 'usuario.google@example.com',
    nome: 'Usuário Google',
    emailAutoritativo: true,
  };

  function criarDependencias() {
    const prisma = {
      usuario: {
        findUnique: jest.fn<Promise<UsuarioTeste | null>, unknown[]>(),
        update: jest.fn<Promise<UsuarioTeste>, unknown[]>(),
        create: jest.fn<Promise<UsuarioTeste>, unknown[]>(),
      },
      sessao: {
        create: jest.fn<Promise<object>, unknown[]>().mockResolvedValue({}),
      },
    };

    const configService = {
      get: jest.fn(() => undefined),
    };

    const googleIdentityService = {
      verificarCredential: jest
        .fn<Promise<IdentidadeGoogleVerificada>, [string]>()
        .mockResolvedValue(identidade),
    };

    const service = new AuthService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      googleIdentityService as unknown as GoogleIdentityService,
    );

    return { prisma, googleIdentityService, service };
  }

  it('entra em conta já vinculada pelo googleSub sem criar outro usuário', async () => {
    const { prisma, service } = criarDependencias();
    const usuario: UsuarioTeste = {
      id: 10,
      nome: 'Conta Existente',
      email: identidade.email,
      senhaHash: 'hash',
      googleSub: identidade.sub,
      papel: PapelUsuario.EDITOR,
      ativo: true,
    };

    prisma.usuario.findUnique.mockResolvedValueOnce(usuario);

    const resultado = await service.autenticarComGoogle({
      credential: 'credential-valida-com-mais-de-vinte-caracteres',
    });

    expect(resultado.novoUsuario).toBe(false);
    expect(resultado.usuario).toMatchObject({
      id: 10,
      papel: PapelUsuario.EDITOR,
    });
    expect(prisma.usuario.create).not.toHaveBeenCalled();
    expect(prisma.sessao.create).toHaveBeenCalledTimes(1);
  });

  it('vincula pelo e-mail uma conta local já existente e preserva o papel', async () => {
    const { prisma, service } = criarDependencias();
    const usuarioLocal: UsuarioTeste = {
      id: 20,
      nome: 'Usuário Local',
      email: identidade.email,
      senhaHash: 'hash-local',
      googleSub: null,
      papel: PapelUsuario.REVISOR,
      ativo: true,
    };
    const usuarioVinculado: UsuarioTeste = {
      ...usuarioLocal,
      googleSub: identidade.sub,
    };

    prisma.usuario.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(usuarioLocal);
    prisma.usuario.update.mockResolvedValueOnce(usuarioVinculado);

    const resultado = await service.autenticarComGoogle({
      credential: 'credential-valida-com-mais-de-vinte-caracteres',
    });

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { googleSub: identidade.sub },
    });
    expect(resultado.novoUsuario).toBe(false);
    expect(resultado.usuario.papel).toBe(PapelUsuario.REVISOR);
  });

  it('não vincula automaticamente e-mail de provedor externo a conta local', async () => {
    const { prisma, googleIdentityService, service } = criarDependencias();
    const usuarioLocal: UsuarioTeste = {
      id: 25,
      nome: 'Usuário Local Externo',
      email: identidade.email,
      senhaHash: 'hash-local',
      googleSub: null,
      papel: PapelUsuario.USUARIO,
      ativo: true,
    };

    prisma.usuario.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(usuarioLocal);

    const googleExterno: IdentidadeGoogleVerificada = {
      ...identidade,
      emailAutoritativo: false,
    };
    googleIdentityService.verificarCredential.mockResolvedValueOnce(
      googleExterno,
    );

    await expect(
      service.autenticarComGoogle({
        credential: 'credential-valida-com-mais-de-vinte-caracteres',
      }),
    ).rejects.toThrow('Já existe uma conta com este e-mail.');

    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('cria primeiro acesso Google sempre como USUARIO', async () => {
    const { prisma, service } = criarDependencias();
    const usuarioCriado: UsuarioTeste = {
      id: 30,
      nome: identidade.nome,
      email: identidade.email,
      senhaHash: 'hash-gerado',
      googleSub: identidade.sub,
      papel: PapelUsuario.USUARIO,
      ativo: true,
    };

    prisma.usuario.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.usuario.create.mockResolvedValueOnce(usuarioCriado);

    const resultado = await service.autenticarComGoogle({
      credential: 'credential-valida-com-mais-de-vinte-caracteres',
    });

    expect(prisma.usuario.create).toHaveBeenCalledTimes(1);

    const chamadaCriacao = prisma.usuario.create.mock.calls[0]?.[0] as {
      data: {
        email: string;
        googleSub: string;
        papel: PapelUsuario;
      };
    };

    expect(chamadaCriacao.data).toMatchObject({
      email: identidade.email,
      googleSub: identidade.sub,
      papel: PapelUsuario.USUARIO,
    });
    expect(resultado.novoUsuario).toBe(true);
    expect(resultado.usuario.papel).toBe(PapelUsuario.USUARIO);
  });
});
