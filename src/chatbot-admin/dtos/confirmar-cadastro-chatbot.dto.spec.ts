import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AjustesCadastroChatbotDto,
  ConfirmarCadastroChatbotDto,
} from './confirmar-cadastro-chatbot.dto';

describe('ConfirmarCadastroChatbotDto', () => {
  it('aceita categoria e dados corrigidos informados pelo chat', async () => {
    const dto = plainToInstance(ConfirmarCadastroChatbotDto, {
      tokenConfirmacao: '7f734e54-640b-4664-a26f-77c23e023f2a',
      confirmar: true,
      ajustes: {
        categoria: 'CELULAR',
        preco: 918,
        dadosCorrigidos: {
          nome: 'Motorola Moto G35 256GB',
          marca: 'Motorola',
          modelo: 'Moto G35',
        },
      },
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejeita categoria fora do contrato da IA', async () => {
    const dto = plainToInstance(AjustesCadastroChatbotDto, {
      categoria: 'QUALQUER_COISA',
    });

    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'categoria')).toBe(true);
  });
});
