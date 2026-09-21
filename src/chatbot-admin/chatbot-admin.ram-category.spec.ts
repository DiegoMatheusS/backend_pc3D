import 'reflect-metadata';
import { ChatbotAdminService } from './chatbot-admin.service';

describe('ChatbotAdminService RAM classification guard', () => {
  const service = new ChatbotAdminService({} as never, {} as never, {} as never);

  function parece(url: string, payload: Record<string, unknown>) {
    return (
      service as unknown as {
        pareceMemoriaRam: (url: URL, payload: Record<string, unknown>) => boolean;
      }
    ).pareceMemoriaRam(new URL(url), payload);
  }

  it('reconhece memória com capacidade antes de DDR', () => {
    expect(
      parece('https://loja.com/produto', {
        nome: 'Kingston Fury Beast 16GB 3200MHz DDR4 CL16',
        modelo: 'KF432C16BB/16',
      }),
    ).toBe(true);
  });

  it('reconhece memória pelo slug do marketplace', () => {
    expect(
      parece(
        'https://www.mercadolivre.com.br/memoria-kingston-fury-beast-16gb-ddr4-3200mhz/p/MLB123',
        { nome: 'Kingston Fury Beast' },
      ),
    ).toBe(true);
  });

  it('não transforma notebook em memória RAM', () => {
    expect(
      parece('https://loja.com/notebook-lenovo-16gb-ddr5', {
        nome: 'Notebook Lenovo Ryzen 7 16GB DDR5 512GB SSD',
      }),
    ).toBe(false);
  });

  it('não transforma smartphone em memória RAM', () => {
    expect(
      parece('https://loja.com/smartphone-galaxy', {
        nome: 'Smartphone Galaxy 8GB RAM 256GB',
      }),
    ).toBe(false);
  });
});
