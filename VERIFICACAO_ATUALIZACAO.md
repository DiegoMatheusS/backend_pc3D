# Como validar esta atualização no seu computador

## 1. Preserve o seu `.env`

O ZIP entregue não contém `.env` nem `.env.local`. Mantenha o arquivo que já funciona no seu computador.

## 2. Faça backup do banco antes da migration grande

A migration é incremental e foi escrita para preservar Hardwares e Ofertas existentes, mas uma alteração estrutural desse tamanho deve ser aplicada com backup do PostgreSQL.

**Não use `prisma migrate reset`.**

## 3. Prisma

Na pasta do backend:

```bash
npx prisma validate
npx prisma migrate dev
npx prisma generate
```

A migration `20260803230000_expandir_loja_produtos` cria a camada Produto/Loja e migra os Hardwares existentes para Produtos com o mesmo ID.

Depois confira:

```bash
npx prisma migrate status
```

## 4. Checagens obrigatórias de código

```bash
npm run format
npm run lint
npm run build
```

Se qualquer comando falhar, pare nesse ponto e corrija o primeiro erro antes de seguir.

## 5. Testes

```bash
npm test
npm run test:e2e
```

## 6. Subir a API

```bash
npm run start:dev
```

## 7. Smoke tests sugeridos

```text
GET /api/status
GET /api/produtos
GET /api/categorias-produto
GET /api/hardwares
GET /api/notebooks
GET /api/builds
GET /api/ofertas/parceiros
GET /api/docs
```

Em produção o Swagger só é habilitado se `SWAGGER_ENABLED=true`.

## 8. Testes administrativos sugeridos

Depois de logar como ADMIN/EDITOR conforme a rota:

- criar Produto MONITOR;
- criar Produto MOUSE;
- cadastrar parceiro;
- cadastrar duas ofertas do mesmo Produto em parceiros/vendedores diferentes;
- consultar ficha pública do Produto;
- consultar histórico da Oferta;
- criar Notebook em rascunho e publicar;
- criar Build comercial em rascunho e publicar;
- importar uma URL pública de produto;
- testar IA administrativa, se `GEMINI_API_KEY` estiver configurada.

## 9. Avaliações

- visitante: `GET /api/produtos/:id/avaliacoes`;
- autenticado: POST;
- mesmo usuário envia POST de novo: deve atualizar a própria avaliação;
- outro usuário não pode editar/remover a avaliação;
- ADMIN/REVISOR podem moderar.

## 10. Regressão do montador 3D

Repita os cenários já validados antes da expansão:

- 2 RAMs iguais com `instanciaId` diferente;
- 3 ventoinhas iguais em pontos diferentes;
- mesmo ponto físico ocupado duas vezes deve dar 400;
- ciclo entre instâncias deve dar 400;
- RAM/SSD/ventoinhas repetidos devem ser contados fisicamente;
- modelo 3D ausente deve tornar a montagem não renderizável, sem invalidar categoria externa à montagem.

## Ordem de diagnóstico se algo falhar

1. `npx prisma validate`
2. `npx prisma migrate status`
3. `npx prisma generate`
4. `npm run lint`
5. `npm run build`
6. `npm test`
7. `npm run test:e2e`
8. `npm run start:dev`

Envie o **primeiro erro completo** encontrado. Corrigir na ordem evita trabalhar em erros derivados.
