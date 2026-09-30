import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CriarOfertaDto } from '../dtos/criar-oferta.dto';
import { AtualizarOfertaDto } from '../dtos/atualizar-oferta.dto';
import { CriarOfertaInicialProdutoDto } from '../../produtos/dtos/criar-oferta-inicial-produto.dto';
import { ImportarOfertaExtensaoProdutoIaDto } from '../../produto-ia-integracao-interna/dtos/importar-oferta-extensao-produto-ia.dto';
import { normalizarUrlAmazon } from './normalizar-url-amazon';

describe('normalizarUrlAmazon', () => {
  const noisyLink = 'https://www.amazon.com.br/PROCESSADOR-AMD-5700X/dp/B09VCHQHZ6/ref=sr_1_23?'
    + `dib=${'abc123'.repeat(150)}&qid=1790778217&sr=1-23`;

  it('remove tokens de busca, mantendo URL canônica e ASIN', () => {
    expect(normalizarUrlAmazon(noisyLink)).toBe('https://www.amazon.com.br/dp/B09VCHQHZ6');
  });

  it('preserva tag e subtag de afiliados, inclusive quando o link original é longo', () => {
    const affiliate = `${noisyLink}&tag=criabyte-20&ascsubtag=campanha-1`;
    expect(normalizarUrlAmazon(affiliate)).toBe(
      'https://www.amazon.com.br/dp/B09VCHQHZ6?tag=criabyte-20&ascsubtag=campanha-1',
    );
  });

  it('não altera links de outras lojas ou links Amazon sem ASIN reconhecível', () => {
    const ml = 'https://produto.mercadolivre.com.br/MLB-123?x=1';
    expect(normalizarUrlAmazon(ml)).toBe(ml);
    const amazonUnknown = 'https://www.amazon.com.br/s?k=processador';
    expect(normalizarUrlAmazon(amazonUnknown)).toBe(amazonUnknown);
  });

  it('não aceita hosts parecidos não pertencentes à Amazon', () => {
    const spoof = 'https://amazon.com.br.evil.example/dp/B09VCHQHZ6';
    expect(normalizarUrlAmazon(spoof)).toBe(spoof);
  });

  it('permite criar e editar oferta usando DTOs com links Amazon longos', async () => {
    const create = plainToInstance(CriarOfertaDto, {
      produtoId: 1,
      parceiroId: 1,
      preco: 900,
      urlOriginal: noisyLink,
      urlAfiliada: `${noisyLink}&tag=criabyte-20`,
    });
    expect(create.urlOriginal).toBe('https://www.amazon.com.br/dp/B09VCHQHZ6');
    expect(create.urlAfiliada).toContain('tag=criabyte-20');
    expect(await validate(create)).toEqual([]);

    const update = plainToInstance(AtualizarOfertaDto, {
      urlOriginal: noisyLink,
      urlAfiliada: `${noisyLink}&tag=criabyte-20`,
    });
    expect(update.urlOriginal).toHaveLength(create.urlOriginal.length);
    expect(await validate(update)).toEqual([]);
  });

  it('aceita oferta inicial com links Amazon longos no cadastro de produto', async () => {
    const initial = plainToInstance(CriarOfertaInicialProdutoDto, {
      parceiroId: 1,
      preco: 899.99,
      urlOriginal: noisyLink,
      urlAfiliada: `${noisyLink}&tag=criabyte-20`,
    });
    expect(initial.urlOriginal).toBe('https://www.amazon.com.br/dp/B09VCHQHZ6');
    expect(initial.urlAfiliada).toContain('tag=criabyte-20');
    expect(await validate(initial)).toEqual([]);
  });

  it('aceita links Amazon longos enviados pelo endpoint aninhado da extensão', async () => {
    const request = plainToInstance(ImportarOfertaExtensaoProdutoIaDto, {
      hardwareExistenteId: 10,
      parceiro: { nome: 'Amazon', dominio: 'amazon.com.br' },
      oferta: {
        urlOriginal: noisyLink,
        urlAfiliada: `${noisyLink}&tag=criabyte-20`,
        preco: 899.99,
      },
    });
    expect(request.oferta.urlOriginal).toBe('https://www.amazon.com.br/dp/B09VCHQHZ6');
    expect(request.oferta.urlAfiliada).toContain('tag=criabyte-20');
    expect(await validate(request)).toEqual([]);
  });
});
