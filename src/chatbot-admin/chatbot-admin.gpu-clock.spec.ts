import 'reflect-metadata';
import { ChatbotAdminService } from './chatbot-admin.service';

describe('ChatbotAdminService GPU clock normalization', () => {
  const service = new ChatbotAdminService({} as never, {} as never, {} as never);

  it('remove boost conflitante vindo da IA em vez de falhar na confirmação', () => {
    const payload: Record<string, unknown> = {
      especificacaoPlacaVideo: {
        clockBaseMhz: 1600,
        clockBoostMhz: 902,
        comprimentoMm: 146,
      },
    };

    const changed = (
      service as unknown as {
        normalizarClockPlacaVideoIa: (value: Record<string, unknown>) => boolean;
      }
    ).normalizarClockPlacaVideoIa(payload);

    expect(changed).toBe(true);
    expect(payload.especificacaoPlacaVideo).toEqual({
      clockBaseMhz: 1600,
      comprimentoMm: 146,
    });
  });

  it('preserva clocks coerentes', () => {
    const payload: Record<string, unknown> = {
      especificacaoPlacaVideo: {
        clockBaseMhz: 2205,
        clockBoostMhz: 2505,
        comprimentoMm: 240,
      },
    };

    const changed = (
      service as unknown as {
        normalizarClockPlacaVideoIa: (value: Record<string, unknown>) => boolean;
      }
    ).normalizarClockPlacaVideoIa(payload);

    expect(changed).toBe(false);
    expect(payload.especificacaoPlacaVideo).toEqual({
      clockBaseMhz: 2205,
      clockBoostMhz: 2505,
      comprimentoMm: 240,
    });
  });
});
