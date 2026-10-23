import { PersistentLimits } from './persistent-limits.module';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import * as argon2 from 'argon2';
import { TOTP, Secret } from 'otpauth';
import { createTransport } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class AccountSecurityService {
  private readonly logger = new Logger(AccountSecurityService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: PersistentLimits,
  ) {}
  hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
  private encryptionKey() {
    const key = Buffer.from(process.env.AUTH_ENCRYPTION_KEY || '', 'base64');
    if (key.length !== 32)
      throw new ServiceUnavailableException(
        'Configuração de autenticação em duas etapas pendente.',
      );
    return key;
  }
  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    return Buffer.concat([
      iv,
      cipher.update(value),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString('base64');
  }
  private decrypt(value: string) {
    const bytes = Buffer.from(value, 'base64');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([
      decipher.update(bytes.subarray(12, -16)),
      decipher.final(),
    ]).toString();
  }
  async token(
    usuarioId: number,
    finalidade: string,
    seconds: number,
    dados?: string,
  ) {
    const value = randomBytes(32).toString('base64url');
    await this.prisma.tokenAcesso.create({
      data: {
        hash: this.hash(value),
        usuarioId,
        finalidade,
        expiraEm: new Date(Date.now() + seconds * 1000),
        dados,
      },
    });
    return value;
  }
  async challenge(usuarioId: number) {
    const account = await this.prisma.segurancaConta.findUnique({
      where: { usuarioId },
    });
    if (!account?.segredo) return null;
    return {
      requires2fa: true as const,
      desafio: await this.token(usuarioId, 'MFA', 300),
    };
  }
  async status(usuarioId: number) {
    const row = await this.prisma.segurancaConta.findUnique({
      where: { usuarioId },
    });
    return {
      habilitado: Boolean(row?.segredo),
      codigosRestantes: row?.recuperacao.length ?? 0,
    };
  }
  async setup(usuarioId: number, senha: string) {
    this.encryptionKey();
    const user = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
    });
    if (!(await argon2.verify(user.senhaHash, senha)))
      throw new UnauthorizedException('Confirme sua senha atual.');
    if ((await this.status(usuarioId)).habilitado)
      throw new BadRequestException(
        'A autenticação em duas etapas já está ativa.',
      );
    const otp = new TOTP({
      issuer: 'CriaByte',
      label: user.email,
      secret: new Secret({ size: 20 }),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    const desafio = await this.token(
      usuarioId,
      'MFA_SETUP',
      600,
      this.encrypt(otp.secret.base32),
    );
    return { desafio, segredo: otp.secret.base32, uri: otp.toString() };
  }
  private async attempt(hash: string, finalidade: string) {
    const result = await this.prisma.tokenAcesso.updateMany({
      where: {
        hash,
        finalidade,
        usadoEm: null,
        expiraEm: { gt: new Date() },
        tentativas: { lt: 5 },
      },
      data: { tentativas: { increment: 1 } },
    });
    if (!result.count)
      throw new UnauthorizedException(
        'Desafio expirado ou limite de tentativas atingido.',
      );
  }
  async activate(usuarioId: number, desafio: string, codigo: string) {
    await this.attempt(this.hash(desafio), 'MFA_SETUP');
    const token = await this.prisma.tokenAcesso.findUnique({
      where: { hash: this.hash(desafio) },
    });
    if (
      !token ||
      token.usuarioId !== usuarioId ||
      token.finalidade !== 'MFA_SETUP' ||
      token.usadoEm ||
      token.expiraEm.getTime() <= Date.now() ||
      !token.dados
    )
      throw new UnauthorizedException('Configuração expirada.');
    const otp = new TOTP({
      secret: Secret.fromBase32(this.decrypt(token.dados)),
    });
    const delta = /^\d{6}$/.test(codigo)
      ? otp.validate({ token: codigo, window: 1 })
      : null;
    if (delta === null) throw new UnauthorizedException('Código inválido.');
    const codes = Array.from({ length: 8 }, () =>
      randomBytes(16).toString('hex'),
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${usuarioId}, 2942)`;
      if (await tx.segurancaConta.findUnique({ where: { usuarioId } }))
        throw new BadRequestException(
          'A autenticação em duas etapas já está ativa.',
        );
      const consumed = await tx.tokenAcesso.updateMany({
        where: {
          hash: token.hash,
          usadoEm: null,
          expiraEm: { gt: new Date() },
        },
        data: { usadoEm: new Date() },
      });
      if (!consumed.count)
        throw new UnauthorizedException('Configuração já utilizada.');
      await tx.segurancaConta.create({
        data: {
          usuarioId,
          segredo: token.dados,
          ultimoPasso: BigInt(Math.floor(Date.now() / 30000) + delta),
          recuperacao: codes.map((code) => this.hash(code)),
        },
      });
      await tx.tokenAcesso.updateMany({
        where: {
          usuarioId,
          finalidade: { in: ['MFA', 'MFA_SETUP'] },
          usadoEm: null,
        },
        data: { usadoEm: new Date() },
      });
      await tx.sessao.updateMany({
        where: { usuarioId, revogadaEm: null },
        data: { revogadaEm: new Date() },
      });
    });
    return { codigosRecuperacao: codes };
  }
  private async verify(
    tx: Prisma.TransactionClient,
    usuarioId: number,
    codigo: string,
  ) {
    const row = await tx.segurancaConta.findUnique({ where: { usuarioId } });
    if (!row?.segredo)
      throw new UnauthorizedException(
        'Autenticação em duas etapas indisponível.',
      );
    if (/^\d{6}$/.test(codigo)) {
      const otp = new TOTP({
        secret: Secret.fromBase32(this.decrypt(row.segredo)),
      });
      const delta = otp.validate({ token: codigo, window: 1 });
      if (delta !== null) {
        const step = BigInt(Math.floor(Date.now() / 30000) + delta);
        const updated = await tx.segurancaConta.updateMany({
          where: {
            usuarioId,
            OR: [{ ultimoPasso: null }, { ultimoPasso: { lt: step } }],
          },
          data: { ultimoPasso: step },
        });
        if (updated.count) return;
      }
    } else if (/^[a-f0-9]{32}$/i.test(codigo)) {
      const hash = this.hash(codigo.toLowerCase());
      const updated =
        await tx.$executeRaw`UPDATE seguranca_conta SET recuperacao=array_remove(recuperacao,${hash}) WHERE usuario_id=${usuarioId} AND ${hash}=ANY(recuperacao)`;
      if (updated === 1) return;
    }
    throw new UnauthorizedException('Código inválido ou já utilizado.');
  }
  private async reserveMfa(usuarioId: number) {
    const limit = await this.limits.increment(
      `mfa:${usuarioId}`,
      900000,
      10,
      900000,
    );
    if (limit.isBlocked)
      throw new HttpException(
        'Muitas tentativas de segundo fator. Aguarde para tentar novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
  async complete(desafio: string, codigo: string) {
    await this.attempt(this.hash(desafio), 'MFA');
    const identity = await this.prisma.tokenAcesso.findUniqueOrThrow({
      where: { hash: this.hash(desafio) },
    });
    await this.reserveMfa(identity.usuarioId);
    const usuarioId = await this.prisma.$transaction(async (tx) => {
      const hash = this.hash(desafio);
      const token = await tx.tokenAcesso.findUnique({ where: { hash } });
      if (
        !token ||
        token.finalidade !== 'MFA' ||
        token.usadoEm ||
        token.expiraEm.getTime() <= Date.now()
      )
        throw new UnauthorizedException('Desafio inválido ou expirado.');
      const consumed = await tx.tokenAcesso.updateMany({
        where: { hash, usadoEm: null, expiraEm: { gt: new Date() } },
        data: { usadoEm: new Date() },
      });
      if (!consumed.count)
        throw new UnauthorizedException('Desafio já utilizado.');
      await this.verify(tx, token.usuarioId, codigo);
      return token.usuarioId;
    });
    await this.limits.clear(`mfa:${usuarioId}`);
    return usuarioId;
  }
  async disable(usuarioId: number, senha: string, codigo: string) {
    const user = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
    });
    if (!(await argon2.verify(user.senhaHash, senha)))
      throw new UnauthorizedException('Senha inválida.');
    await this.reserveMfa(usuarioId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${usuarioId}, 2942)`;
      await this.verify(tx, usuarioId, codigo);
      await tx.segurancaConta.delete({ where: { usuarioId } });
      await tx.tokenAcesso.updateMany({
        where: {
          usuarioId,
          finalidade: { in: ['MFA', 'MFA_SETUP'] },
          usadoEm: null,
        },
        data: { usadoEm: new Date() },
      });
      await tx.sessao.updateMany({
        where: { usuarioId },
        data: { revogadaEm: new Date() },
      });
    });
    await this.limits.clear(`mfa:${usuarioId}`);
    return { desativado: true };
  }
  async recover(email: string) {
    const host = process.env.SMTP_HOST;
    const from = process.env.SMTP_FROM;
    const base = process.env.AUTH_PUBLIC_URL;
    if (!host || !from || !base || !base.startsWith('https://'))
      throw new ServiceUnavailableException(
        'Recuperação por e-mail ainda não configurada.',
      );
    const response = {
      mensagem: 'Se a conta existir, você receberá as instruções por e-mail.',
    };
    const user = await this.prisma.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user?.ativo) return response;
    const token = await this.token(user.id, 'RESET', 1200);
    const url = new URL('/redefinir-senha', base);
    url.hash = new URLSearchParams({ token }).toString();
    void createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: process.env.SMTP_SECURE !== 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 10000,
    })
      .sendMail({
        from,
        to: user.email,
        subject: 'Redefina sua senha no CriaByte',
        text: `Use este link em até 20 minutos para redefinir sua senha:\n${url.href}\nSe não pediu esta alteração, ignore a mensagem.`,
      })
      .catch(async () => {
        await this.prisma.tokenAcesso
          .deleteMany({ where: { hash: this.hash(token) } })
          .catch(() => {});
        this.logger.warn(
          'Falha no envio de recuperação de senha. Confira a configuração SMTP.',
        );
      });

    return response;
  }
  async reset(token: string, senha: string) {
    const hash = this.hash(token);
    const password = await argon2.hash(senha, { type: argon2.argon2id });
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.tokenAcesso.findUnique({
        where: { hash },
        include: { usuario: true },
      });
      if (
        !row ||
        row.finalidade !== 'RESET' ||
        row.usadoEm ||
        row.expiraEm.getTime() <= Date.now() ||
        !row.usuario.ativo
      )
        throw new UnauthorizedException('Link inválido ou expirado.');
      const consumed = await tx.tokenAcesso.updateMany({
        where: { hash, usadoEm: null, expiraEm: { gt: new Date() } },
        data: { usadoEm: new Date() },
      });
      if (!consumed.count)
        throw new UnauthorizedException('Link já utilizado.');
      await tx.usuario.update({
        where: { id: row.usuarioId },
        data: { senhaHash: password },
      });
      await tx.tokenAcesso.updateMany({
        where: { usuarioId: row.usuarioId, usadoEm: null },
        data: { usadoEm: new Date() },
      });
      await tx.sessao.updateMany({
        where: { usuarioId: row.usuarioId, revogadaEm: null },
        data: { revogadaEm: new Date() },
      });
    });
    return { mensagem: 'Senha redefinida. Entre novamente.' };
  }
}
