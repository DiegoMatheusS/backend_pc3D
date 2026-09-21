import 'reflect-metadata';
import { ChatbotAdminService } from './chatbot-admin.service';

describe('ChatbotAdminService parceiro Shopee', () => {
  it('usa Shopee como parceiro mesmo se o domínio do cadastro estiver vazio', async () => {
    const prisma = {
      parceiro: {
        findMany: jest.fn().mockResolvedValue([
          { id: 11, nome: 'Shopee', slug: 'shopee', dominio: null },
          {
            id: 12,
            nome: 'Mercado Livre',
            slug: 'mercado-livre',
            dominio: 'mercadolivre.com.br',
          },
        ]),
      },
    };

    const service = new ChatbotAdminService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const parceiro = await (
      service as unknown as {
        identificarParceiro: (
          url: URL,
          urlAfiliada?: URL | null,
        ) => Promise<{ id: number; nome: string; dominio: string | null } | null>;
      }
    ).identificarParceiro(
      new URL('https://shopee.com.br/product/123/456'),
      null,
    );

    expect(parceiro).toEqual({
      id: 11,
      nome: 'Shopee',
      dominio: null,
    });
  });

  it('mantém outros parceiros por domínio', async () => {
    const prisma = {
      parceiro: {
        findMany: jest.fn().mockResolvedValue([
          { id: 11, nome: 'Shopee', slug: 'shopee', dominio: null },
          {
            id: 12,
            nome: 'Mercado Livre',
            slug: 'mercado-livre',
            dominio: 'mercadolivre.com.br',
          },
        ]),
      },
    };

    const service = new ChatbotAdminService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const parceiro = await (
      service as unknown as {
        identificarParceiro: (
          url: URL,
          urlAfiliada?: URL | null,
        ) => Promise<{ id: number; nome: string; dominio: string | null } | null>;
      }
    ).identificarParceiro(
      new URL('https://produto.mercadolivre.com.br/MLB-123'),
      null,
    );

    expect(parceiro?.id).toBe(12);
  });
});
