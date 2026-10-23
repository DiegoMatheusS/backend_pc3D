import 'reflect-metadata';
import { CategoriaHardware } from '../generated/prisma/enums';
import { ChatbotAdminService } from './chatbot-admin.service';

describe('ChatbotAdminService hardware import normalization', () => {
  const service = new ChatbotAdminService(
    {} as never,
    {} as never,
    {} as never,
  );

  it('remove campos nulos da Fonte e marca o Hardware como publicado', async () => {
    const dto = await (
      service as unknown as {
        validarHardwareDto: (
          payload: Record<string, unknown>,
          categoria: CategoriaHardware,
        ) => Promise<{
          publicado?: boolean;
          ativo?: boolean;
          especificacaoFonte?: {
            formato: string;
            potenciaWatts: number;
            modularidade?: string;
          };
        }>;
      }
    ).validarHardwareDto(
      {
        nome: 'Fonte ATX 700W',
        marca: 'Digital Informatica',
        modelo: '700W',
        especificacaoFonte: {
          formato: 'ATX',
          potenciaWatts: 700,
          modularidade: null,
          eficienciaPercentual: null,
        },
      },
      CategoriaHardware.FONTE,
    );

    expect(dto.publicado).toBe(true);
    expect(dto.ativo).toBe(true);
    expect(dto.especificacaoFonte?.formato).toBe('ATX');
    expect(dto.especificacaoFonte?.potenciaWatts).toBe(700);
    expect(dto.especificacaoFonte?.modularidade).toBeUndefined();
  });

  it.each(['buscarHardware', 'buscarProduto'] as const)(
    '%s reconhece o GTIN mesmo quando a loja não entregou um nome',
    async (method) => {
      const record = { id: 9, nome: 'Item do catálogo' };
      const prisma = {
        hardware: { findFirst: jest.fn().mockResolvedValue(record) },
        produto: { findFirst: jest.fn().mockResolvedValue(record) },
      };
      const instance = new ChatbotAdminService(
        prisma as never,
        {} as never,
        {} as never,
      );
      const queries = instance as unknown as Record<
        typeof method,
        (
          payload: Record<string, unknown>,
        ) => Promise<{ registro: unknown; criterio: string }>
      >;
      const result = await queries[method]({ gtin: '7891234567895' });
      expect(result.registro).toBe(record);
      expect(result.criterio).toBe('GTIN');
    },
  );
});
