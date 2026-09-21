import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AcaoChatbotCadastro,
  AnalisarCadastroChatbotDto,
} from './analisar-cadastro-chatbot.dto';

describe('AnalisarCadastroChatbotDto', () => {
  it('aceita link do produto e link afiliado públicos', async () => {
    const dto = plainToInstance(AnalisarCadastroChatbotDto, {
      acao: AcaoChatbotCadastro.CADASTRAR_PRODUTO,
      url: 'https://www.mercadolivre.com.br/produto',
      urlAfiliada: 'https://www.mercadolivre.com.br/sec/afiliado',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejeita link afiliado sem http/https', async () => {
    const dto = plainToInstance(AnalisarCadastroChatbotDto, {
      acao: AcaoChatbotCadastro.CADASTRAR_PRODUTO,
      url: 'https://shopee.com.br/produto-i.10.20',
      urlAfiliada: 'javascript:alert(1)',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'urlAfiliada')).toBe(true);
  });
});
