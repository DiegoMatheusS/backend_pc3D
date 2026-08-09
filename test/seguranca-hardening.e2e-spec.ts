import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App, criarApp } from './app-setup';

describe('Segurança — hardening de entradas e navegador (e2e)', () => {
  let app: App;

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('rejeita cookie de sessão com token malformado', async () => {
    const config = app.get(ConfigService);
    const cookieName =
      config.get<string>('SESSION_COOKIE_NAME') ?? 'pcbuilder_session';

    const res = await request(app.getHttpServer())
      .get('/api/auth/perfil')
      .set('Cookie', `${cookieName}=token-invalido`);

    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('NAO_AUTENTICADO');
  });

  it('rejeita ID de rota acima do limite INT32 antes de consultar o banco', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/produtos/2147483648',
    );

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('REQUISICAO_INVALIDA');
  });

  it('rejeita slug público fora do formato esperado', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/produtos/slug/slug%3Cscript%3E',
    );

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('REQUISICAO_INVALIDA');
  });

  it('rejeita booleano de filtro com valor arbitrário', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/produtos')
      .query({ comOferta: 'qualquer-coisa' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('REQUISICAO_INVALIDA');
  });

  it('rejeita parâmetro escalar repetido em vez de escolher um valor arbitrariamente', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/produtos?busca=cpu&busca=gpu',
    );

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('REQUISICAO_INVALIDA');
  });

  it('rejeita filtro textual acima do limite', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/produtos')
      .query({ busca: 'x'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('REQUISICAO_INVALIDA');
  });

  it('rejeita histórico de IA acima do limite do DTO', async () => {
    const historico = Array.from({ length: 21 }, (_, indice) => ({
      papel: indice % 2 === 0 ? 'usuario' : 'assistente',
      conteudo: `Mensagem ${indice}`,
    }));

    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .send({ mensagem: 'Quero montar um PC', historico });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('REQUISICAO_INVALIDA');
  });

  it('rejeita objeto livre com profundidade acima do permitido', async () => {
    const buildAtual = {
      a: { b: { c: { d: { e: { f: { g: 'profundo demais' } } } } } },
    };

    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .send({ mensagem: 'Analise esta build', buildAtual });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('REQUISICAO_INVALIDA');
  });

  it('rejeita protocolo não HTTP/HTTPS em URL externa', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/montagem-guiada')
      .send({
        acao: 'SELECIONAR',
        etapaAtual: 'PROCESSADOR',
        componentes: [],
        selecao: {
          categoria: 'PROCESSADOR',
          nome: 'CPU externa',
          origem: 'EXTERNO',
          imagemUrl: 'javascript:alert(1)',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('REQUISICAO_INVALIDA');
  });

  it('bloqueia POST de Origin não autorizado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .set('Origin', 'https://malicioso.example')
      .send({ mensagem: 'Quero montar um PC' });

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('ORIGEM_NAO_PERMITIDA');
  });

  it('bloqueia navegador marcado como cross-site mesmo sem Origin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ mensagem: 'Quero montar um PC' });

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('ORIGEM_NAO_PERMITIDA');
  });

  it('aceita POST da origem autorizada', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .set('Origin', 'http://localhost:5173')
      .set('Sec-Fetch-Site', 'same-site')
      .send({ mensagem: 'Quero montar um PC gamer' });

    expect(res.status).toBe(200);
    expect(res.body.fluxoGuiado?.tipo).toBe('MONTAGEM_GUIADA');
  });

  it('aceita origem autorizada mesmo quando navegador a classifica como cross-site', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .set('Origin', 'http://localhost:5173')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ mensagem: 'Quero montar um PC gamer' });

    expect(res.status).toBe(200);
    expect(res.body.fluxoGuiado?.tipo).toBe('MONTAGEM_GUIADA');
  });

  it('padroniza JSON malformado como 400 sem expor erro interno', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .set('Content-Type', 'application/json')
      .send('{"mensagem":"teste",');

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('REQUISICAO_INVALIDA');
  });

  it('rejeita corpo acima de 1 MB antes dos controllers', async () => {
    const corpo = JSON.stringify({ mensagem: 'x'.repeat(1_100_000) });
    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .set('Content-Type', 'application/json')
      .send(corpo);

    expect(res.status).toBe(413);
    expect(res.body.codigo).toBe('PAYLOAD_MUITO_GRANDE');
  });

  it('rejeita arrays globais excessivos antes de chegar ao serviço', async () => {
    const historico = Array.from({ length: 201 }, () => ({
      papel: 'usuario',
      conteudo: 'x',
    }));

    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .send({ mensagem: 'teste', historico });

    expect(res.status).toBe(413);
    expect(res.body.codigo).toBe('PAYLOAD_MUITO_GRANDE');
  });

  it('rejeita chave associada a prototype pollution em JSON livre', async () => {
    const corpo = JSON.stringify({
      mensagem: 'Analise',
      buildAtual: JSON.parse('{"__proto__":{"admin":true}}'),
    });

    const res = await request(app.getHttpServer())
      .post('/api/ia/chat')
      .set('Content-Type', 'application/json')
      .send(corpo);

    expect(res.status).toBe(413);
    expect(res.body.codigo).toBe('PAYLOAD_MUITO_GRANDE');
  });
});
