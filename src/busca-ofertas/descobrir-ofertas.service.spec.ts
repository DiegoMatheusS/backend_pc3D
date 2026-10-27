import { DescobrirOfertasService } from './descobrir-ofertas.service';
import { postProdutoIa } from '../ia/produto-ia-http';
import { DescobrirOfertasDto } from './dtos/descobrir-ofertas.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
jest.mock('../ia/produto-ia-http', () => ({ postProdutoIa: jest.fn() }));
const post = jest.mocked(postProdutoIa);
describe('busca em outras lojas', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.PRODUTO_IA_URL = 'https://agent.example';
    process.env.PRODUTO_IA_API_KEY = 'test-service';
    post.mockReset();
  });
  afterAll(() => {
    process.env = saved;
  });
  it.each(['MERCADO_LIVRE', 'MAGALU'] as const)(
    'encaminha %s à integração interna sem cadastrar automaticamente',
    async (loja) => {
      post.mockResolvedValue(
        new Response(
          JSON.stringify({
            itens: [{ nome: 'RTX 4060', urlAfiliada: null }],
            avisos: [],
          }),
        ),
      );
      const result = await new DescobrirOfertasService().buscar({
        loja,
        consulta: ' RTX 4060 ',
        limite: 12,
      });
      expect(result).toHaveProperty('itens');
      const [url, options] = post.mock.calls[0];
      expect(url).toBe('https://agent.example/ofertas/descobrir');
      expect(JSON.parse(String(options.body))).toMatchObject({
        loja,
        consulta: 'RTX 4060',
      });
    },
  );
  it('falhas de acesso e resposta inválida produzem mensagem utilizável', async () => {
    post.mockResolvedValue(new Response('negado', { status: 403 }));
    await expect(
      new DescobrirOfertasService().buscar({
        loja: 'MAGALU',
        consulta: 'RTX 4060',
      }),
    ).rejects.toThrow('consultar');
    post.mockResolvedValue(new Response('{}'));
    await expect(
      new DescobrirOfertasService().buscar({
        loja: 'MAGALU',
        consulta: 'RTX 4060',
      }),
    ).rejects.toThrow('inválidos');
  });
  it('não faz chamadas sem configurar a integração', async () => {
    delete process.env.PRODUTO_IA_API_KEY;
    await expect(
      new DescobrirOfertasService().buscar({
        loja: 'MAGALU',
        consulta: 'RTX 4060',
      }),
    ).rejects.toThrow('configurada');
    expect(post).not.toHaveBeenCalled();
  });
  it('rejeita lojas arbitrárias e limites excessivos', async () => {
    const errors = await validate(
      plainToInstance(DescobrirOfertasDto, {
        loja: 'http://localhost',
        consulta: 'x',
        limite: 1000,
      }),
    );
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['loja', 'consulta', 'limite']),
    );
  });
});
