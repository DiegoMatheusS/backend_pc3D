import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CriarOfertaDto } from '../dtos/criar-oferta.dto';
import { AtualizarOfertaDto } from '../dtos/atualizar-oferta.dto';
import { CriarOfertaInicialProdutoDto } from '../../produtos/dtos/criar-oferta-inicial-produto.dto';
import { OfertaExtensaoDto } from '../../produto-ia-integracao-interna/dtos/importar-oferta-extensao-produto-ia.dto';
import { CriarSugestaoOfertaDto } from '../../sugestoes-ofertas/dtos/criar-sugestao-oferta.dto';
import { AprovarSugestaoOfertaDto } from '../../sugestoes-ofertas/dtos/aprovar-sugestao-oferta.dto';
import { CATEGORIAS_SUGESTAO_OFERTA } from '../../sugestoes-ofertas/campos-sugestao-oferta';
import { LIMITE_URL_OFERTA } from './limite-url-oferta';

const link = (host: string) => `https://${host}/produto?trace=${'xyz123'.repeat(250)}&affiliate_id=canal%2Bparceiro&source=campanha`;
const stores = ['www.mercadolivre.com.br', 'shopee.com.br', 'www.magazineluiza.com.br', 'loja-nova.example'];

describe('URLs longas de todas as lojas', () => {
  it.each(stores)('não altera nem rejeita link original ou afiliado: %s', async (host) => {
    const original = link(host);
    const affiliate = `${original}&partner=codigo-extra`;
    expect(original.length).toBeGreaterThan(500);
    const created = plainToInstance(CriarOfertaDto, {
      produtoId: 1, parceiroId: 1, preco: 99, urlOriginal: original, urlAfiliada: affiliate,
    });
    expect(created.urlOriginal).toBe(original);
    expect(created.urlAfiliada).toBe(affiliate);
    expect(await validate(created)).toEqual([]);

    const edited = plainToInstance(AtualizarOfertaDto, { urlOriginal: original, urlAfiliada: affiliate });
    expect(edited.urlOriginal).toBe(original);
    expect(await validate(edited)).toEqual([]);

    const initial = plainToInstance(CriarOfertaInicialProdutoDto, { parceiroId: 1, preco: 99, urlOriginal: original, urlAfiliada: affiliate });
    expect(await validate(initial)).toEqual([]);
    expect(initial.urlAfiliada).toBe(affiliate);

    const extension = plainToInstance(OfertaExtensaoDto, { urlOriginal: original, urlAfiliada: affiliate, preco: 99 });
    expect(await validate(extension)).toEqual([]);
    expect(extension.urlAfiliada).toBe(affiliate);

    const suggestion = plainToInstance(CriarSugestaoOfertaDto, {
      nome: 'Produto de teste', categoria: CATEGORIAS_SUGESTAO_OFERTA[0], preco: 99, urlOriginal: original,
    });
    expect(await validate(suggestion)).toEqual([]);
    const approved = plainToInstance(AprovarSugestaoOfertaDto, { urlAfiliada: affiliate });
    expect(await validate(approved)).toEqual([]);
  });

  it('continua rejeitando links acima do limite global explícito', async () => {
    const excess = `https://example.com/p?x=${'a'.repeat(LIMITE_URL_OFERTA)}`;
    const created = plainToInstance(CriarOfertaDto, {
      produtoId: 1, parceiroId: 1, preco: 99, urlOriginal: excess,
    });
    const failures = await validate(created);
    expect(failures.find((row) => row.property === 'urlOriginal')?.constraints?.maxLength).toBeTruthy();
  });
});
